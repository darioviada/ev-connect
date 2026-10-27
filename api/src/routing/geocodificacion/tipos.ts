export interface Lugar {
  nombre: string;
  descripcion: string;
  lat: number;
  lng: number;
}

export interface GeocodingProvider {
  readonly nombre: 'static' | 'nominatim';
  buscar(consulta: string): Promise<Lugar[]>;
}

export class GeocodificacionNoDisponibleError extends Error {
  constructor(mensaje: string, opciones?: { cause?: unknown }) {
    super(mensaje, opciones);
    this.name = 'GeocodificacionNoDisponibleError';
  }
}
