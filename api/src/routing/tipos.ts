// Contrato de los proveedores de rutas (SPEC §7). El resto del código no sabe cuál está activo.

export interface LatLng {
  lat: number;
  lng: number;
}

export type FuenteCelda = 'offline-estimado' | 'google' | 'google-cache';

export interface Celda {
  distanciaM: number;
  duracionS: number;
  fuente: FuenteCelda;
}

export interface ResultadoMatriz {
  /** celdas[i][j] = origenes[i] → destinos[j] */
  celdas: Celda[][];
  /** Elementos pedidos a la API externa en esta consulta (los que tienen costo). */
  elementosConsultados: number;
  /** Elementos resueltos desde la caché. */
  elementosDesdeCache: number;
  /** Avisos para el usuario (p. ej. caída al modo offline). */
  advertencias: string[];
}

export interface RoutingProvider {
  readonly nombre: 'offline' | 'google';
  matrix(origenes: readonly LatLng[], destinos: readonly LatLng[]): Promise<ResultadoMatriz>;
}
