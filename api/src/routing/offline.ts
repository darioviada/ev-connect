// OfflineProvider (modo demo, sin servicios externos): distancia = Haversine × 1.35 (factor de circuito,
// para aproximar el recorrido por calles) y velocidad media según la distancia. No considera tráfico.
import { distanciaRectaKm } from '../engine/geo.js';
import type { Celda, LatLng, ResultadoMatriz, RoutingProvider, Trazado } from './tipos.js';

export const FACTOR_CIRCUITO = 1.35;

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

export function estimarCelda(a: LatLng, b: LatLng): Celda {
  const distanciaM = haversineM(a, b) * FACTOR_CIRCUITO;
  const km = distanciaM / 1000;
  return {
    distanciaM: Math.round(distanciaM),
    duracionS: Math.round((km / velocidadMediaKmh(km)) * 3600),
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
