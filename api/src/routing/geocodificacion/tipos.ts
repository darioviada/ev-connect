export interface Lugar {
  nombre: string;
  descripcion: string;
  lat: number;
  lng: number;
}

export interface OpcionesBusqueda {
  /** Punto de referencia: se priorizan los resultados cercanos (sin excluir los demás). */
  cerca?: { lat: number; lng: number };
}

export interface GeocodingProvider {
  readonly nombre: 'static' | 'nominatim';
  buscar(consulta: string, opciones?: OpcionesBusqueda): Promise<Lugar[]>;
}

export class GeocodificacionNoDisponibleError extends Error {
  constructor(mensaje: string, opciones?: { cause?: unknown }) {
    super(mensaje, opciones);
    this.name = 'GeocodificacionNoDisponibleError';
  }
}
