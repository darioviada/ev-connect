// Análisis de cada escenario y resumen (SPEC §12.2 a §12.4). Funciones puras.
//
// - Sistema: la recomendación del camino real de la API (preselección SQL de hasta 8 + motor).
// - Línea base ("selección manual simulada"): entre TODOS los cargadores compatibles, alcanzables y
//   disponibles, el más cercano (en modo ruta, el de menor desvío), como lo elegiría una persona mirando
//   un mapa. Se le asume información perfecta de compatibilidad y disponibilidad (supuesto favorable a la base).
// - Óptimo: el mejor puntaje del motor evaluando todos los cargadores por fuerza bruta (sin preselección).
// - Grado de optimalidad = score(sistema) / score(óptimo), con AMBOS puntajes calculados en el mismo conjunto
//   (fuerza bruta): los puntajes min–max solo son comparables dentro de un mismo conjunto de candidatos.
import { urgenciaDe } from '../engine/reglas.js';
import type { Recomendacion, ResultadoMotor } from '../engine/tipos.js';
import type { Escenario } from './escenarios.js';

export interface Eleccion {
  id: string;
  nombre: string;
  /** Criterio de cercanía de la línea base: distancia en modo ubicación, desvío en modo ruta. */
  criterioKm: number;
  distanciaKm: number;
  desvioKm: number | null;
  esperaMin: number;
  cargaMin: number;
  totalMin: number;
  costo: number;
  /** Puntaje del cargador dentro del conjunto completo (fuerza bruta). */
  scoreConjuntoCompleto: number;
}

export interface FilaEscenario {
  id: number;
  modo: Escenario['modo'];
  vehiculo: string;
  conector: string;
  bateriaPct: number;
  urgencia: ReturnType<typeof urgenciaDe>;
  fecha: string;
  hora: string;
  destino: string | null;
  candidatosSistema: number;
  preseleccionAmpliada: boolean;
  /** Cargadores factibles (compatibles, alcanzables y disponibles) en el conjunto completo. */
  factibles: number;
  sistema: Eleccion | null;
  base: Eleccion | null;
  optimo: Eleccion | null;
  /** score(sistema) / score(óptimo) × 100, en el conjunto completo. */
  optimalidadPct: number | null;
  sinSolucionSistema: string | null;
  sinSolucionCompleto: string | null;
}

/** La "selección manual": el factible más cercano (desvío en modo ruta); desempate por distancia y nombre. */
export function elegirLineaBase(
  factibles: readonly Recomendacion[],
  modo: Escenario['modo'],
): Recomendacion | null {
  const criterio = (r: Recomendacion) =>
    modo === 'ruta' ? (r.metricas.desvioKm ?? r.metricas.distanciaKm) : r.metricas.distanciaKm;
  return (
    [...factibles].sort(
      (a, b) =>
        criterio(a) - criterio(b) ||
        a.metricas.distanciaKm - b.metricas.distanciaKm ||
        a.cargador.nombre.localeCompare(b.cargador.nombre, 'es'),
    )[0] ?? null
  );
}

function aEleccion(
  rec: Recomendacion,
  completo: Map<string, Recomendacion>,
  modo: Escenario['modo'],
): Eleccion {
  const enCompleto = completo.get(rec.cargador.id);
  const elegido = enCompleto ?? rec;
  const m = elegido.metricas;
  // Con plan de viaje (D-045), espera, carga, tiempo total y costo son los del viaje completo.
  const t = elegido.plan?.totales;
  return {
    id: rec.cargador.id,
    nombre: rec.cargador.nombre,
    criterioKm: modo === 'ruta' ? (m.desvioKm ?? m.distanciaKm) : m.distanciaKm,
    distanciaKm: m.distanciaKm,
    desvioKm: m.desvioKm ?? null,
    esperaMin: t?.esperaMin ?? m.esperaMin,
    cargaMin: t?.cargaMin ?? m.cargaMin,
    totalMin: t?.totalMin ?? m.totalMin,
    costo: t?.costoEstimado ?? m.costoEstimado,
    scoreConjuntoCompleto: enCompleto?.score ?? Number.NaN,
  };
}

export function analizarEscenario(
  escenario: Escenario,
  sistema: { resultado: ResultadoMotor; candidatos: number; preseleccionAmpliada: boolean },
  completo: ResultadoMotor,
): FilaEscenario {
  const factibles = completo.recomendaciones;
  const porId = new Map(factibles.map((r) => [r.cargador.id, r]));
  const recSistema = sistema.resultado.recomendaciones[0] ?? null;
  const recOptimo = factibles[0] ?? null;
  const recBase = elegirLineaBase(factibles, escenario.modo);

  const eleccionSistema = recSistema ? aEleccion(recSistema, porId, escenario.modo) : null;
  const eleccionOptimo = recOptimo ? aEleccion(recOptimo, porId, escenario.modo) : null;
  const optimalidadPct =
    eleccionSistema && eleccionOptimo && eleccionOptimo.scoreConjuntoCompleto > 0
      ? (eleccionSistema.scoreConjuntoCompleto / eleccionOptimo.scoreConjuntoCompleto) * 100
      : null;

  return {
    id: escenario.id,
    modo: escenario.modo,
    vehiculo: escenario.modelo.descripcion,
    conector: escenario.modelo.vehiculo.tipoConector,
    bateriaPct: escenario.bateriaPct,
    urgencia: urgenciaDe(escenario.bateriaPct),
    fecha: escenario.fecha,
    hora: escenario.hora,
    destino: escenario.destinoNombre ?? null,
    candidatosSistema: sistema.candidatos,
    preseleccionAmpliada: sistema.preseleccionAmpliada,
    factibles: factibles.length,
    sistema: eleccionSistema,
    base: recBase ? aEleccion(recBase, porId, escenario.modo) : null,
    optimo: eleccionOptimo,
    optimalidadPct,
    sinSolucionSistema: sistema.resultado.sinResultados?.codigo ?? null,
    sinSolucionCompleto: completo.sinResultados?.codigo ?? null,
  };
}

// --- Estadística --------------------------------------------------------------------------------

export const promedio = (xs: readonly number[]) =>
  xs.length === 0 ? Number.NaN : xs.reduce((a, b) => a + b, 0) / xs.length;

export function mediana(xs: readonly number[]): number {
  if (xs.length === 0) return Number.NaN;
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m]! : (o[m - 1]! + o[m]!) / 2;
}

/** Mejora porcentual del sistema respecto de la base para un criterio "menor es mejor". */
export const mejoraPct = (base: number, sistema: number) =>
  base === 0 ? (sistema === 0 ? 0 : Number.NaN) : ((base - sistema) / base) * 100;

export type Metrica =
  'criterioKm' | 'distanciaKm' | 'esperaMin' | 'cargaMin' | 'totalMin' | 'costo';

export interface ComparacionMetrica {
  metrica: Metrica;
  sistemaPromedio: number;
  basePromedio: number;
  sistemaMediana: number;
  baseMediana: number;
  /** (base − sistema) / base sobre los promedios; positivo = el sistema es mejor (menor). */
  mejoraPromedioPct: number;
  /** % de escenarios en que el sistema es estrictamente mejor / igual / peor que la base. */
  mejorPct: number;
  igualPct: number;
  peorPct: number;
}

export interface Resumen {
  escenarios: number;
  comparables: number;
  sinSolucionCompleto: number;
  /** Hay solución evaluando todos los cargadores, pero no dentro de la preselección. */
  sinSolucionPorPreseleccion: number;
  distintoDeBasePct: number;
  igualAlOptimoPct: number;
  optimalidad: { promedio: number; mediana: number; minimo: number };
  metricas: ComparacionMetrica[];
}

export const METRICAS: readonly Metrica[] = [
  'criterioKm',
  'distanciaKm',
  'esperaMin',
  'cargaMin',
  'totalMin',
  'costo',
];

export function resumir(filas: readonly FilaEscenario[]): Resumen {
  const comparables = filas.filter((f) => f.sistema && f.base);
  const pct = (n: number, total: number) => (total === 0 ? Number.NaN : (n / total) * 100);
  const optimalidades = filas.flatMap((f) => (f.optimalidadPct === null ? [] : [f.optimalidadPct]));

  const metricas = METRICAS.map((metrica): ComparacionMetrica => {
    const sis = comparables.map((f) => f.sistema![metrica]);
    const base = comparables.map((f) => f.base![metrica]);
    const comparar = (i: number) => Math.sign(base[i]! - sis[i]!); // 1 = sistema mejor
    const signos = sis.map((_, i) => comparar(i));
    return {
      metrica,
      sistemaPromedio: promedio(sis),
      basePromedio: promedio(base),
      sistemaMediana: mediana(sis),
      baseMediana: mediana(base),
      mejoraPromedioPct: mejoraPct(promedio(base), promedio(sis)),
      mejorPct: pct(signos.filter((s) => s > 0).length, signos.length),
      igualPct: pct(signos.filter((s) => s === 0).length, signos.length),
      peorPct: pct(signos.filter((s) => s < 0).length, signos.length),
    };
  });

  return {
    escenarios: filas.length,
    comparables: comparables.length,
    sinSolucionCompleto: filas.filter((f) => f.sinSolucionCompleto).length,
    sinSolucionPorPreseleccion: filas.filter((f) => f.sinSolucionSistema && !f.sinSolucionCompleto)
      .length,
    distintoDeBasePct: pct(
      comparables.filter((f) => f.sistema!.id !== f.base!.id).length,
      comparables.length,
    ),
    igualAlOptimoPct: pct(
      comparables.filter((f) => f.sistema!.id === f.optimo?.id).length,
      comparables.length,
    ),
    optimalidad: {
      promedio: promedio(optimalidades),
      mediana: mediana(optimalidades),
      minimo: optimalidades.length ? Math.min(...optimalidades) : Number.NaN,
    },
    metricas,
  };
}
