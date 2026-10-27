// Estado de una búsqueda en la URL (?b=…): sobrevive a ir al detalle y volver, a recargar y a compartir.
import type { LatLng, PedidoRecomendacion } from '../api/tipos';

export interface Busqueda extends PedidoRecomendacion {
  /** Textos para mostrar (no se envían a la API). */
  origenNombre?: string;
  destinoNombre?: string;
}

const aBase64Url = (texto: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(texto)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const deBase64Url = (b64: string) =>
  new TextDecoder().decode(
    Uint8Array.from(atob(b64.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
  );

export function codificarBusqueda(b: Busqueda): string {
  return aBase64Url(JSON.stringify(b));
}

const esPunto = (p: unknown): p is LatLng =>
  typeof p === 'object' &&
  p !== null &&
  Number.isFinite((p as LatLng).lat) &&
  Number.isFinite((p as LatLng).lng);

/** Devuelve null si el parámetro falta o no es válido (la API vuelve a validar todo). */
export function decodificarBusqueda(param: string | null): Busqueda | null {
  if (!param) return null;
  try {
    const b = JSON.parse(deBase64Url(param)) as Busqueda;
    if (!b.vehiculo || typeof b.bateriaPct !== 'number' || !esPunto(b.origen)) return null;
    if (b.modo !== 'ubicacion' && b.modo !== 'ruta') return null;
    if (b.modo === 'ruta' && !esPunto(b.destino)) return null;
    return b;
  } catch {
    return null;
  }
}

/** Solo lo que espera POST /recomendaciones. */
export function aPedido(b: Busqueda): PedidoRecomendacion {
  return {
    vehiculo: b.vehiculo,
    bateriaPct: b.bateriaPct,
    modo: b.modo,
    origen: b.origen,
    ...(b.modo === 'ruta' && b.destino ? { destino: b.destino } : {}),
  };
}
