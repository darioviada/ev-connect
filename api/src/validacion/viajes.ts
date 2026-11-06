// Validación de viajes largos con paradas (D-045). Funciones puras salvo `ejecutarViajes`.
//
// - Escenarios: origen al azar en Córdoba capital, destino lejano (Rosario, Buenos Aires o Mendoza),
//   vehículo del catálogo, batería de 20 a 100 % y hora al azar en la semana de referencia.
// - Sistema: el camino real de la API (preselección + plan de viaje). Se toma el primer recomendado.
// - Línea base: entre todas las primeras paradas posibles (fuerza bruta), la de menor desvío, con el
//   mismo planificador para el resto del viaje (una persona que carga "en el camino").
// - Mínimo: el plan de menor tiempo total entre todas las primeras paradas posibles (fuerza bruta).
import { crearAleatorio } from '../../seeds/aleatorio.js';
import type { Recomendacion } from '../engine/tipos.js';
import { minutosLocales } from '../engine/tiempo.js';
import type { LatLng } from '../engine/tipos.js';
import { columnasCargador, type FilaCargador } from '../modules/cargadores/cargadores.repo.js';
import {
  calcularRecomendacion,
  construirCandidatos,
  ejecutarMotor,
  type ContextoCalculo,
  type PedidoMotor,
} from '../modules/recomendaciones/servicio.js';
import { elegirLineaBase, mediana, mejoraPct, promedio } from './analisis.js';
import { FECHA_BASE, ZONA_ORIGEN, type ModeloCatalogo } from './escenarios.js';

export const DESTINOS_LARGOS: readonly { nombre: string; punto: LatLng }[] = [
  { nombre: 'Rosario', punto: { lat: -32.9468, lng: -60.6393 } },
  { nombre: 'Buenos Aires', punto: { lat: -34.6037, lng: -58.3816 } },
  { nombre: 'Mendoza', punto: { lat: -32.8895, lng: -68.8458 } },
];

export interface EscenarioViaje {
  id: number;
  modelo: ModeloCatalogo;
  bateriaPct: number;
  origen: LatLng;
  destino: LatLng;
  destinoNombre: string;
  fecha: string;
  hora: string;
  ahora: Date;
}

const r5 = (x: number) => Math.round(x * 1e5) / 1e5;
const dos = (n: number) => String(n).padStart(2, '0');

export function generarViajes(opciones: {
  semilla: number;
  cantidad: number;
  catalogo: readonly ModeloCatalogo[];
}): EscenarioViaje[] {
  // Generador propio (otra secuencia que los escenarios principales): agregar viajes no los altera.
  const azar = crearAleatorio(opciones.semilla + 100_003);
  const viajes: EscenarioViaje[] = [];
  for (let id = 1; id <= opciones.cantidad; id++) {
    const modelo = azar.elegir(opciones.catalogo);
    const bateriaPct = azar.entero(20, 100);
    const origen = {
      lat: r5(azar.entre(ZONA_ORIGEN.latMin, ZONA_ORIGEN.latMax)),
      lng: r5(azar.entre(ZONA_ORIGEN.lngMin, ZONA_ORIGEN.lngMax)),
    };
    const destino = DESTINOS_LARGOS[(id - 1) % DESTINOS_LARGOS.length]!;
    const dia = azar.entero(0, 6);
    const [a, m, d] = FECHA_BASE.split('-').map(Number) as [number, number, number];
    const fecha = new Date(Date.UTC(a, m - 1, d + dia)).toISOString().slice(0, 10);
    // Salidas de día (6 a 18 h): un viaje largo de noche cruza franjas cerradas y no es representativo.
    const minuto = azar.entero(6 * 60, 18 * 60);
    const hora = `${dos(Math.floor(minuto / 60))}:${dos(minuto % 60)}`;
    viajes.push({
      id,
      modelo,
      bateriaPct,
      origen,
      destino: destino.punto,
      destinoNombre: destino.nombre,
      fecha,
      hora,
      ahora: new Date((minutosLocales(fecha, hora) + 3 * 60) * 60_000),
    });
  }
  return viajes;
}

export interface FilaViaje {
  id: number;
  vehiculo: string;
  conector: string;
  bateriaPct: number;
  destino: string;
  distanciaKm: number;
  llegaSinCargar: boolean;
  /** Código de "sin resultados" del sistema (null = hay plan). */
  sinSolucionSistema: string | null;
  sinSolucionCompleto: string | null;
  paradasSistema: number | null;
  totalMinSistema: number | null;
  costoSistema: number | null;
  totalMinBase: number | null;
  totalMinMinimo: number | null;
}

const totalDe = (r: Recomendacion | null | undefined) => r?.plan?.totales.totalMin ?? null;

export async function ejecutarViajes(
  ctx: Omit<ContextoCalculo, 'reloj'>,
  zonaHoraria: string,
  escenarios: readonly EscenarioViaje[],
): Promise<FilaViaje[]> {
  const activos: FilaCargador[] = await ctx
    .db('cargador as c')
    .select(columnasCargador(ctx.db))
    .where('c.estado', 'activo')
    .orderBy('c.id');

  const filas: FilaViaje[] = [];
  for (const esc of escenarios) {
    const reloj = { ahora: () => esc.ahora, zonaHoraria };
    const c = { ...ctx, reloj };
    const pedido: PedidoMotor = {
      vehiculo: esc.modelo.vehiculo,
      bateriaPct: esc.bateriaPct,
      modo: 'ruta',
      origen: esc.origen,
      destino: esc.destino,
    };
    const sistema = await calcularRecomendacion(c, pedido);
    const todos = await construirCandidatos(c, activos, pedido);
    const completo = ejecutarMotor(pedido, todos, reloj, sistema.cargadoresRuta);

    const elegido = sistema.resultado.recomendaciones[0];
    const base = elegirLineaBase(completo.recomendaciones, 'ruta');
    const totales = completo.recomendaciones.flatMap((r) =>
      r.plan ? [r.plan.totales.totalMin] : [],
    );
    filas.push({
      id: esc.id,
      vehiculo: esc.modelo.descripcion,
      conector: esc.modelo.vehiculo.tipoConector,
      bateriaPct: esc.bateriaPct,
      destino: esc.destinoNombre,
      distanciaKm: sistema.resultado.viaje?.distanciaKm ?? Number.NaN,
      llegaSinCargar: sistema.resultado.viaje?.llegaSinCargar ?? false,
      sinSolucionSistema: sistema.resultado.sinResultados?.codigo ?? null,
      sinSolucionCompleto: completo.sinResultados?.codigo ?? null,
      paradasSistema: elegido?.plan ? elegido.plan.paradas.length : null,
      totalMinSistema: totalDe(elegido),
      costoSistema: elegido?.plan?.totales.costoEstimado ?? null,
      totalMinBase: totalDe(base),
      totalMinMinimo: totales.length ? Math.min(...totales) : null,
    });
  }
  return filas;
}

export interface ResumenViajes {
  grupo: string;
  escenarios: number;
  posiblesSistema: number;
  posiblesCompleto: number;
  paradasPromedio: number;
  totalMinSistema: number;
  totalMinBase: number;
  totalMinMinimo: number;
  /** (base − sistema) / base sobre los promedios del tiempo total. */
  mejoraVsBasePct: number;
  /** Cuánto más tarda el sistema que el mínimo posible (promedio de los cocientes − 1). */
  sobreMinimoPct: number;
  sobreMinimoMediana: number;
}

export function resumirViajes(grupo: string, filas: readonly FilaViaje[]): ResumenViajes {
  const comparables = filas.filter(
    (f) => f.totalMinSistema !== null && f.totalMinBase !== null && f.totalMinMinimo !== null,
  );
  const sobre = comparables.map((f) => (f.totalMinSistema! / f.totalMinMinimo! - 1) * 100);
  const sis = promedio(comparables.map((f) => f.totalMinSistema!));
  const base = promedio(comparables.map((f) => f.totalMinBase!));
  return {
    grupo,
    escenarios: filas.length,
    posiblesSistema: filas.filter((f) => !f.sinSolucionSistema).length,
    posiblesCompleto: filas.filter((f) => !f.sinSolucionCompleto).length,
    paradasPromedio: promedio(
      filas.flatMap((f) => (f.paradasSistema === null ? [] : [f.paradasSistema])),
    ),
    totalMinSistema: sis,
    totalMinBase: base,
    totalMinMinimo: promedio(comparables.map((f) => f.totalMinMinimo!)),
    mejoraVsBasePct: mejoraPct(base, sis),
    sobreMinimoPct: promedio(sobre),
    sobreMinimoMediana: mediana(sobre),
  };
}

const CAMPOS_CSV: (keyof FilaViaje)[] = [
  'id',
  'vehiculo',
  'conector',
  'bateriaPct',
  'destino',
  'distanciaKm',
  'llegaSinCargar',
  'sinSolucionSistema',
  'sinSolucionCompleto',
  'paradasSistema',
  'totalMinSistema',
  'costoSistema',
  'totalMinBase',
  'totalMinMinimo',
];

export function viajesACsv(filas: readonly FilaViaje[]): string {
  const celda = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const t = String(v);
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return (
    [CAMPOS_CSV.join(','), ...filas.map((f) => CAMPOS_CSV.map((k) => celda(f[k])).join(','))].join(
      '\n',
    ) + '\n'
  );
}
