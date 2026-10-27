// GEOCODING_PROVIDER=nominatim: proxy al servicio público de OpenStreetMap, SOLO para uso liviano de demo.
// Política de uso (https://operations.osmfoundation.org/policies/nominatim/, verificada el 2026-10-27):
//   - como máximo 1 pedido por segundo para toda la aplicación (acá: cola global con 1 s entre pedidos);
//   - User-Agent propio que identifique la aplicación;
//   - cachear resultados (acá: caché en memoria de 24 h);
//   - PROHIBIDO el autocompletado: la interfaz debe buscar solo cuando el usuario confirma la búsqueda;
//   - mostrar la atribución de OpenStreetMap;
//   - poder apagarlo sin actualizar el software (GEOCODING_PROVIDER=static).
// Endpoint verificado en https://nominatim.org/release-docs/latest/api/Search/ (q, format=jsonv2,
// countrycodes, limit, accept-language; lat/lon llegan como texto).
import { normalizarTexto } from './static.js';
import { GeocodificacionNoDisponibleError, type GeocodingProvider, type Lugar } from './tipos.js';

export const URL_NOMINATIM = 'https://nominatim.openstreetmap.org/search';
export const USER_AGENT_NOMINATIM = 'EVConnect-TFG-demo/0.1 (demo academica de un trabajo final)';

interface ResultadoNominatim {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
}

export interface OpcionesNominatim {
  fetch?: typeof fetch;
  /** Reloj y espera inyectables (tests). */
  ahora?: () => number;
  esperar?: (ms: number) => Promise<void>;
  intervaloMinimoMs?: number;
  ttlCacheMs?: number;
  maxEntradasCache?: number;
  timeoutMs?: number;
}

export class NominatimProvider implements GeocodingProvider {
  readonly nombre = 'nominatim' as const;
  readonly #o: Required<OpcionesNominatim>;
  readonly #cache = new Map<string, { lugares: Lugar[]; vence: number }>();
  #cola: Promise<unknown> = Promise.resolve();
  #ultimoPedido = -Infinity;

  constructor(opciones: OpcionesNominatim = {}) {
    this.#o = {
      fetch: globalThis.fetch,
      ahora: () => Date.now(),
      esperar: (ms) => new Promise((r) => setTimeout(r, ms)),
      intervaloMinimoMs: 1000,
      ttlCacheMs: 24 * 60 * 60 * 1000,
      maxEntradasCache: 500,
      timeoutMs: 5000,
      ...opciones,
    };
  }

  async buscar(consulta: string): Promise<Lugar[]> {
    const clave = normalizarTexto(consulta);
    if (!clave) return [];
    const enCache = this.#cache.get(clave);
    if (enCache && enCache.vence > this.#o.ahora()) return enCache.lugares;

    // Los pedidos se encolan para respetar 1 pedido/segundo aunque lleguen juntos.
    const tarea = this.#cola.then(() => this.#pedir(clave));
    this.#cola = tarea.catch(() => undefined);
    return tarea;
  }

  async #pedir(clave: string): Promise<Lugar[]> {
    // Otra solicitud en la cola pudo haber resuelto la misma consulta.
    const enCache = this.#cache.get(clave);
    if (enCache && enCache.vence > this.#o.ahora()) return enCache.lugares;

    const espera = this.#ultimoPedido + this.#o.intervaloMinimoMs - this.#o.ahora();
    if (espera > 0) await this.#o.esperar(espera);
    this.#ultimoPedido = this.#o.ahora();

    const url = new URL(URL_NOMINATIM);
    url.search = new URLSearchParams({
      q: clave,
      format: 'jsonv2',
      countrycodes: 'ar',
      limit: '5',
      'accept-language': 'es',
    }).toString();

    let datos: ResultadoNominatim[];
    try {
      const respuesta = await this.#o.fetch(url, {
        headers: { 'User-Agent': USER_AGENT_NOMINATIM, Accept: 'application/json' },
        signal: AbortSignal.timeout(this.#o.timeoutMs),
      });
      if (!respuesta.ok) throw new Error(`Nominatim respondió ${respuesta.status}`);
      datos = (await respuesta.json()) as ResultadoNominatim[];
    } catch (error) {
      throw new GeocodificacionNoDisponibleError('La búsqueda de direcciones no está disponible.', {
        cause: error,
      });
    }

    const lugares = datos
      .map((d) => ({
        nombre: d.name?.trim() || d.display_name.split(',')[0]!.trim(),
        descripcion: d.display_name,
        lat: Number.parseFloat(d.lat),
        lng: Number.parseFloat(d.lon),
      }))
      .filter((l) => Number.isFinite(l.lat) && Number.isFinite(l.lng));

    if (this.#cache.size >= this.#o.maxEntradasCache) {
      this.#cache.delete(this.#cache.keys().next().value!); // la más antigua
    }
    this.#cache.set(clave, { lugares, vence: this.#o.ahora() + this.#o.ttlCacheMs });
    return lugares;
  }
}
