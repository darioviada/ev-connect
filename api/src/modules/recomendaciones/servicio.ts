// Cálculo de una recomendación a partir de la base: preselección espacial → RoutingProvider → franjas y
// reservas → motor (puro). Lo usan POST /recomendaciones y `npm run validate` (así se valida exactamente
// el mismo camino que recorre la API).
import type { Knex } from 'knex';
import { recomendar } from '../../engine/recomendar.js';
import { CONFIG_MOTOR } from '../../engine/config.js';
import { alcanceMaximoKm, esCompatible } from '../../engine/reglas.js';
import type {
  CandidatoMotor,
  CargadorRuta,
  LatLng,
  Modo,
  ResultadoMotor,
  VehiculoMotor,
} from '../../engine/tipos.js';
import type { Config } from '../../config/index.js';
import { haversineM } from '../../routing/offline.js';
import type { Celda, RoutingProvider, Trazado } from '../../routing/tipos.js';
import {
  aCargadorMotor,
  aFranjaMotor,
  franjasPorCargador,
  type FilaCargador,
} from '../cargadores/cargadores.repo.js';
import { CONECTORES, hhmm } from '../comun/esquemas.js';
import { fechaRelativa, type Reloj } from '../comun/reloj.js';
import { porViaje, preseleccionar, type Preseleccion } from './preseleccion.js';

/**
 * Plan de viaje (D-045): corredor alrededor del trazado real o, sin trazado, de la recta. En viajes largos
 * la ruta se aparta mucho de la recta (camino a Rosario, la RN 9 pasa por Villa María, ~64 km al norte),
 * así que sin trazado el corredor crece con la longitud del viaje: 20 % de lo que exceda los 50 km. Los
 * viajes cortos (hasta 50 km en línea recta) no cambian.
 */
const CORREDOR_VIAJE_TRAZADO_KM = 10;
const CORREDOR_VIAJE_RECTA_MIN_KM = 20;
const CORREDOR_RECTA_FRACCION = 0.2;
const CORREDOR_RECTA_DESDE_KM = 50;
const LIMITE_CARGADORES_VIAJE = 300;

/** Línea del viaje y anchos de corredor (primera parada y plan) según haya trazado real o no. */
function geometriaViaje(pedido: PedidoMotor, trazado: Trazado | null, corredorKm: number) {
  if (trazado && trazado.puntos.length >= 2) {
    return { linea: trazado.puntos, corredorKm, corredorPlanKm: CORREDOR_VIAJE_TRAZADO_KM };
  }
  const rectaKm = haversineM(pedido.origen, pedido.destino!) / 1000;
  const extraKm = CORREDOR_RECTA_FRACCION * Math.max(0, rectaKm - CORREDOR_RECTA_DESDE_KM);
  return {
    linea: [pedido.origen, pedido.destino!],
    corredorKm: Math.max(corredorKm, extraKm),
    corredorPlanKm: Math.max(CORREDOR_VIAJE_RECTA_MIN_KM, extraKm),
  };
}

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

  const agendas = await agendasDe(db, reloj, filas);
  const candidatos: CandidatoMotor[] = filas.map((_, i) => ({
    ...agendas[i]!,
    desdeOrigen: aTrayecto(desdeOrigen[i]!),
    ...(pedido.modo === 'ruta' ? { haciaDestino: aTrayecto(haciaDestino[i]!) } : {}),
  }));

  return {
    candidatos,
    directo,
    elementosConsultados,
    elementosDesdeCache,
    advertencias: [...advertencias],
  };
}

/** Cargador con sus franjas y reservas activas (de ayer a pasado mañana). */
async function agendasDe(
  db: Knex,
  reloj: Reloj,
  filas: readonly FilaCargador[],
): Promise<CargadorRuta[]> {
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
  return filas.map((f) => ({
    cargador: aCargadorMotor(f),
    franjas: franjas.get(f.id)!.map(aFranjaMotor),
    reservas: reservas
      .filter((r) => r.cargador_id === f.id)
      .map((r) => ({ fecha: r.fecha, horaInicio: hhmm(r.hora_inicio), horaFin: hhmm(r.hora_fin) })),
  }));
}

/** Modo ruta (D-045): cargadores compatibles a lo largo de todo el viaje, posibles paradas del plan. */
export async function cargadoresDelViaje(
  ctx: ContextoCalculo,
  pedido: PedidoMotor,
  trazado: Trazado | null,
): Promise<CargadorRuta[]> {
  const conectores = CONECTORES.filter((c) => esCompatible(pedido.vehiculo, c));
  const g = geometriaViaje(pedido, trazado, ctx.engine.corridorKm);
  const filas = await porViaje(
    ctx.db,
    g.linea,
    conectores,
    g.corredorPlanKm,
    LIMITE_CARGADORES_VIAJE,
  );
  return agendasDe(ctx.db, ctx.reloj, filas);
}

/** Ejecuta el motor sobre candidatos ya construidos. */
export function ejecutarMotor(
  pedido: PedidoMotor,
  construidos: CandidatosConstruidos,
  reloj: Reloj,
  cargadoresRuta?: readonly CargadorRuta[],
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
    ...(cargadoresRuta ? { cargadoresRuta } : {}),
    config: { zonaHoraria: reloj.zonaHoraria },
  });
}

export interface ResultadoCalculo extends CandidatosConstruidos {
  resultado: ResultadoMotor;
  preseleccion: Preseleccion;
  /** Solo modo ruta: camino real por calles (Google) o null (offline o error). */
  trazado: Trazado | null;
  /** Solo modo ruta: cargadores de todo el viaje que usó el plan (vacío en modo ubicación). */
  cargadoresRuta: CargadorRuta[];
}

/** Camino completo de la API: preselección (solo compatibles, D-027) → rutas → motor. */
export async function calcularRecomendacion(
  ctx: ContextoCalculo,
  pedido: PedidoMotor,
): Promise<ResultadoCalculo> {
  const compatibles = CONECTORES.filter((c) => esCompatible(pedido.vehiculo, c));
  // Modo ruta: el trazado sirve para dibujar el camino y para buscar las paradas sobre él (D-045).
  const trazado =
    pedido.modo === 'ruta' ? await ctx.rutas.trazado(pedido.origen, pedido.destino!) : null;
  const geometria =
    pedido.modo === 'ruta' ? geometriaViaje(pedido, trazado, ctx.engine.corridorKm) : null;
  const parametros = {
    modo: pedido.modo,
    origen: pedido.origen,
    ...(pedido.destino ? { destino: pedido.destino } : {}),
    radioKm: ctx.engine.searchRadiusKm,
    corredorKm: geometria?.corredorKm ?? ctx.engine.corridorKm,
    limite: ctx.engine.candidatesLimit,
    ...(geometria ? { linea: geometria.linea } : {}),
  };
  // La recta es una cota inferior del recorrido: si ni eso alcanza, seguro hay que cargar en el camino.
  const alcanceActualKm = alcanceMaximoKm(pedido.vehiculo, pedido.bateriaPct, CONFIG_MOTOR);
  const necesitaCargar =
    pedido.modo === 'ruta' && haversineM(pedido.origen, pedido.destino!) / 1000 > alcanceActualKm;
  // En ruta, los lugares de la preselección se usan solo en cargadores alcanzables (D-044).
  let preseleccion = await preseleccionar(ctx.db, {
    ...parametros,
    conectores: compatibles,
    ...(pedido.modo === 'ruta'
      ? { alcanceKm: alcanceActualKm, priorizarPotencia: necesitaCargar }
      : {}),
  });
  if (preseleccion.filas.length === 0 && pedido.modo === 'ruta') {
    // Ninguno alcanzable: se traen igual para que el motor informe FUERA_DE_AUTONOMIA con detalle.
    preseleccion = await preseleccionar(ctx.db, { ...parametros, conectores: compatibles });
  }
  if (preseleccion.filas.length === 0) {
    // Sin compatibles: se traen los cercanos para que el motor informe SIN_COMPATIBLES.
    preseleccion = await preseleccionar(ctx.db, { ...parametros, conectores: CONECTORES });
  }
  const construidos = await construirCandidatos(ctx, preseleccion.filas, pedido);
  const cargadoresRuta =
    pedido.modo === 'ruta' ? await cargadoresDelViaje(ctx, pedido, trazado) : [];
  return {
    ...construidos,
    preseleccion,
    trazado,
    cargadoresRuta,
    resultado: ejecutarMotor(pedido, construidos, ctx.reloj, cargadoresRuta),
  };
}
