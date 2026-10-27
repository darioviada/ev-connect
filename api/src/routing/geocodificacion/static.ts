// GEOCODING_PROVIDER=static: búsqueda en la lista fija, sin acentos ni mayúsculas.
import { LUGARES } from './lugares.js';
import type { GeocodingProvider, Lugar } from './tipos.js';

export const normalizarTexto = (texto: string) =>
  texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

export class StaticGeocodingProvider implements GeocodingProvider {
  readonly nombre = 'static' as const;
  readonly #lugares: readonly Lugar[];

  constructor(lugares: readonly Lugar[] = LUGARES) {
    this.#lugares = lugares;
  }

  async buscar(consulta: string): Promise<Lugar[]> {
    const palabras = normalizarTexto(consulta).split(' ').filter(Boolean);
    if (palabras.length === 0) return [];
    return (
      this.#lugares
        .map((lugar) => ({ lugar, texto: normalizarTexto(lugar.descripcion) }))
        .filter(({ texto }) => palabras.every((p) => texto.includes(p)))
        // Primero los que empiezan con la consulta.
        .sort(
          (a, b) =>
            Number(b.texto.startsWith(palabras[0]!)) - Number(a.texto.startsWith(palabras[0]!)),
        )
        .slice(0, 8)
        .map(({ lugar }) => lugar)
    );
  }
}
