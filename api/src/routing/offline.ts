// OfflineProvider (modo demo, sin servicios externos): distancia = Haversine × factor de circuito (para
// aproximar el recorrido por calles) y velocidad media según la distancia. No considera tráfico.
// Viajes largos (D-045): hasta 50 km en línea recta el factor es 1.35 (SPEC §7); de ahí baja hasta 1.15 a
// los 150 km, porque en ruta el camino se parece más a la recta. Más allá de 80 km se maneja a 90 km/h.
// Así Córdoba–Buenos Aires da ~740 km y ~8 h 40 min en lugar de 873 km y 14 h 30 min. Los tramos cortos
// (y por lo tanto la validación) no cambian.
import { distanciaRectaKm } from '../engine/geo.js';
import type { Celda, LatLng, ResultadoMatriz, RoutingProvider, Trazado } from './tipos.js';

export const FACTOR_CIRCUITO = 1.35;
const FACTOR_RUTA = 1.15;

/** Factor de circuito según la distancia en línea recta (km). */
export function factorCircuito(rectaKm: number): number {
  if (rectaKm <= 50) return FACTOR_CIRCUITO;
  if (rectaKm >= 150) return FACTOR_RUTA;
  return FACTOR_CIRCUITO - ((FACTOR_CIRCUITO - FACTOR_RUTA) * (rectaKm - 50)) / 100;
}

/** Distancia en línea recta sobre la esfera, en metros. */
export function haversineM(a: LatLng, b: LatLng): number {
  return distanciaRectaKm(a, b) * 1000;
}

/** Velocidad media (km/h): 30 hasta 5 km, 40 hasta 25 km, 60 más allá. */
export function velocidadMediaKmh(distanciaKm: number): number {
  if (distanciaKm <= 5) return 30;
  if (distanciaKm <= 25) return 40;
  return 60;
}

/** Duración estimada (h): velocidad media por distancia; pasados 80 km, el resto a 90 km/h. */
export function duracionEstimadaH(km: number): number {
  if (km <= 80) return km / velocidadMediaKmh(km);
  return 80 / 60 + (km - 80) / 90;
}

export function estimarCelda(a: LatLng, b: LatLng): Celda {
  const recta = haversineM(a, b);
  const distanciaM = recta * factorCircuito(recta / 1000);
  const km = distanciaM / 1000;
  return {
    distanciaM: Math.round(distanciaM),
    duracionS: Math.round(duracionEstimadaH(km) * 3600),
    fuente: 'offline-estimado',
  };
}

export class OfflineProvider implements RoutingProvider {
  readonly nombre = 'offline' as const;

  async matrix(origenes: readonly LatLng[], destinos: readonly LatLng[]): Promise<ResultadoMatriz> {
    return {
      celdas: origenes.map((o) => destinos.map((d) => estimarCelda(o, d))),
      elementosConsultados: 0,
      elementosDesdeCache: 0,
      advertencias: [],
    };
  }

  /** Sin servicio externo no hay trazado por calles: la interfaz dibuja una línea recta. */
  async trazado(): Promise<Trazado | null> {
    return null;
  }
}
