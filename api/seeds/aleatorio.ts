// Utilidades deterministas para el seed: generador pseudoaleatorio con semilla fija e identificadores
// estables (el mismo dato recibe siempre el mismo uuid, lo que hace al seed idempotente).
import { createHash } from 'node:crypto';

export interface Aleatorio {
  /** Número en [0, 1). */
  siguiente(): number;
  /** Número en [min, max). */
  entre(min: number, max: number): number;
  /** Entero en [min, max]. */
  entero(min: number, max: number): number;
  elegir<T>(lista: readonly T[]): T;
}

/** Generador mulberry32: rápido, simple y reproducible con la misma semilla. */
export function crearAleatorio(semilla: number): Aleatorio {
  let estado = semilla >>> 0;
  const siguiente = () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    siguiente,
    entre: (min, max) => min + siguiente() * (max - min),
    entero: (min, max) => Math.floor(min + siguiente() * (max - min + 1)),
    elegir: (lista) => {
      if (lista.length === 0) throw new Error('No se puede elegir de una lista vacía');
      return lista[Math.floor(siguiente() * lista.length)]!;
    },
  };
}

/** uuid con formato v5 derivado de una clave de texto: siempre el mismo para la misma clave. */
export function uuidDeterministico(clave: string): string {
  const h = createHash('sha1').update(`ev-connect-seed:${clave}`).digest();
  h[6] = (h[6]! & 0x0f) | 0x50;
  h[8] = (h[8]! & 0x3f) | 0x80;
  const hex = h.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
