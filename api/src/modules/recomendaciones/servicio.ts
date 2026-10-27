// Cálculo de una recomendación a partir de la base: preselección espacial → RoutingProvider → franjas y
// reservas → motor (puro). Lo usan POST /recomendaciones y `npm run validate` (así se valida exactamente
// el mismo camino que recorre la API).
import type { Knex } from 'knex';
import { recomendar } from '../../engine/recomendar.js';
import { esCompatible } from '../../engine/reglas.js';
import type {
  CandidatoMotor,
  LatLng,
  Modo,
  ResultadoMotor,
  VehiculoMotor,
} from '../../engine/tipos.js';
import type { Config } from '../../config/index.js';
import type { Celda, RoutingProvider } from '../../routing/tipos.js';
import {
  aCargadorMotor,
  aFranjaMotor,
  franjasPorCargador,
  type FilaCargador,
} from '../cargadores/cargadores.repo.js';
import { CONECTORES, hhmm } from '../comun/esquemas.js';
import { fechaRelativa, type Reloj } from '../comun/reloj.js';
import { preseleccionar, type Preseleccion } from './preseleccion.js';

export interface PedidoMotor {
  vehiculo: VehiculoMotor;
  bateriaPct: number;
  modo: Modo;
  origen: LatLng;
  destino?: LatLng;
}

export interface ContextoCalculo {
  db: Knex;
  rutas: RoutingProvider;
  engine: Config['engine'];
  reloj: Reloj;
}

export interface CandidatosConstruidos {
  candidatos: CandidatoMotor[];
  /** Solo modo ruta: trayecto directo origen → destino. */
  directo: Celda | undefined;
  elementosConsultados: number;
  elementosDesdeCache: number;
  advertencias: string[];
}

const aTrayecto = (c: Celda) => ({
  distanciaKm: c.distanciaM / 1000,
  duracionMin: c.duracionS / 60,
  fuente: c.fuente,
});

/** Distancias/tiempos (RoutingProvider), franjas y reservas activas de un conjunto de cargadores. */
export async function construirCandidatos(
  ctx: ContextoCalculo,
  filas: readonly FilaCargador[],
  pedido: Pick<PedidoMotor, 'modo' | 'origen' | 'destino'>,
): Promise<CandidatosConstruidos> {
  const { db, rutas, reloj } = ctx;
  let elementosConsultados = 0;
  let elementosDesdeCache = 0;
  const advertencias = new Set<string>();
  const sumar = (r: Awaited<ReturnType<RoutingProvider['matrix']>>) => {
    elementosConsultados += r.elementosConsultados;
    elementosDesdeCache += r.elementosDesdeCache;
    r.advertencias.forEach((a) => advertencias.add(a));
    return r.celdas;
  };

  const puntos = filas.map((f) => ({ lat: f.lat, lng: f.lng }));
  let desdeOrigen: Celda[] = [];
  let haciaDestino: Celda[] = [];
  let directo: Celda | undefined;
  if (filas.length > 0) {
    if (pedido.modo === 'ruta') {
      const fila = sumar(await rutas.matrix([pedido.origen], [...puntos, pedido.destino!]))[0]!;
      desdeOrigen = fila.slice(0, -1);
      directo = fila.at(-1);
      haciaDestino = sumar(await rutas.matrix(puntos, [pedido.destino!])).map((f) => f[0]!);
    } else {
      desdeOrigen = sumar(await rutas.matrix([pedido.origen], puntos))[0]!;
    }
  } else if (pedido.modo === 'ruta') {
    // Sin candidatos no hace falta consultar rutas; el motor devuelve SIN_CARGADORES_CERCANOS.
    directo = { distanciaM: 0, duracionS: 0, fuente: 'offline-estimado' };
  }

  const ids = filas.map((f) => f.id);
  const franjas = await franjasPorCargador(db, ids);
  const reservas =
    ids.length === 0
      ? []
      : await db('reserva')
          .whereIn('cargador_id', ids)
          .whereNot('estado', 'cancelada')
          .whereBetween('fecha', [fechaRelativa(reloj, -1), fechaRelativa(reloj, 2)])
          .select('cargador_id', 'fecha', 'hora_inicio', 'hora_fin');

  const candidatos: CandidatoMotor[] = filas.map((f, i) => ({
    cargador: aCargadorMotor(f),
    desdeOrigen: aTrayecto(desdeOrigen[i]!),
    ...(pedido.modo === 'ruta' ? { haciaDestino: aTrayecto(haciaDestino[i]!) } : {}),
    franjas: franjas.get(f.id)!.map(aFranjaMotor),
    reservas: reservas
      .filter((r) => r.cargador_id === f.id)
      .map((r) => ({ fecha: r.fecha, horaInicio: hhmm(r.hora_inicio), horaFin: hhmm(r.hora_fin) })),
  }));

  return {
    candidatos,
    directo,
    elementosConsultados,
    elementosDesdeCache,
    advertencias: [...advertencias],
  };
}

/** Ejecuta el motor sobre candidatos ya construidos. */
export function ejecutarMotor(
  pedido: PedidoMotor,
  construidos: CandidatosConstruidos,
  reloj: Reloj,
): ResultadoMotor {
  return recomendar({
    vehiculo: pedido.vehiculo,
    bateriaPct: pedido.bateriaPct,
    modo: pedido.modo,
    origen: pedido.origen,
    ...(pedido.destino ? { destino: pedido.destino } : {}),
    ...(construidos.directo ? { trayectoDirecto: aTrayecto(construidos.directo) } : {}),
    ahora: reloj.ahora(),
    candidatos: construidos.candidatos,
    config: { zonaHoraria: reloj.zonaHoraria },
  });
}

export interface ResultadoCalculo extends CandidatosConstruidos {
  resultado: ResultadoMotor;
  preseleccion: Preseleccion;
}

/** Camino completo de la API: preselección (solo compatibles, D-027) → rutas → motor. */
export async function calcularRecomendacion(
  ctx: ContextoCalculo,
  pedido: PedidoMotor,
): Promise<ResultadoCalculo> {
  const compatibles = CONECTORES.filter((c) => esCompatible(pedido.vehiculo, c));
  const parametros = {
    modo: pedido.modo,
    origen: pedido.origen,
    ...(pedido.destino ? { destino: pedido.destino } : {}),
    radioKm: ctx.engine.searchRadiusKm,
    corredorKm: ctx.engine.corridorKm,
    limite: ctx.engine.candidatesLimit,
  };
  let preseleccion = await preseleccionar(ctx.db, { ...parametros, conectores: compatibles });
  if (preseleccion.filas.length === 0) {
    // Sin compatibles: se traen los cercanos para que el motor informe SIN_COMPATIBLES.
    preseleccion = await preseleccionar(ctx.db, { ...parametros, conectores: CONECTORES });
  }
  const construidos = await construirCandidatos(ctx, preseleccion.filas, pedido);
  return {
    ...construidos,
    preseleccion,
    resultado: ejecutarMotor(pedido, construidos, ctx.reloj),
  };
}
