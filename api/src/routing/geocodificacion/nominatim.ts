// GEOCODING_PROVIDER=nominatim: proxy al servicio público de OpenStreetMap, SOLO para uso liviano de demo.
// Política de uso (https://operations.osmfoundation.org/policies/nominatim/, verificada el 2026-10-27):
//   - como máximo 1 pedido por segundo para toda la aplicación (acá: cola global con 1 s entre pedidos);
//   - User-Agent propio que identifique la aplicación;
//   - cachear resultados (acá: caché en memoria de 24 h);
//   - PROHIBIDO el autocompletado: la interfaz debe buscar solo cuando el usuario confirma la búsqueda;
//   - mostrar la atribución de OpenStreetMap;
//   - poder apagarlo sin actualizar el software (GEOCODING_PROVIDER=static).
// Endpoint verificado en https://nominatim.org/release-docs/latest/api/Search/ (q, format=jsonv2,
// countrycodes, limit, accept-language; lat/lon llegan como texto). Verificado el 2026-11-06:
//   - addressdetails=1 agrega `address` (road, house_number, suburb, city, …) para mostrar "Calle 1234";
//   - viewbox=lon1,lat1,lon2,lat2; con bounded=1 filtra a esa caja.
// Estrategia (una misma calle existe en muchas ciudades del país, y la sola prioridad no alcanza):
//   - direcciones (con altura): 1) solo cerca del punto de referencia (caja de ~16 km, bounded=1);
//     2) si no hay resultados, en todo el país priorizando lo cercano (bounded=0);
//   - barrios y ciudades (sin número): directo en todo el país priorizando lo cercano.
// Se expanden abreviaturas habituales ("Bv" → "Bulevar", "Gral" → "General") que Nominatim no reconoce.
import type { LatLng } from '../tipos.js';
import { normalizarTexto } from './static.js';
import {
  GeocodificacionNoDisponibleError,
  type GeocodingProvider,
  type Lugar,
  type OpcionesBusqueda,
} from './tipos.js';

export const URL_NOMINATIM = 'https://nominatim.openstreetmap.org/search';
export const USER_AGENT_NOMINATIM = 'EVConnect-TFG-demo/0.1 (demo academica de un trabajo final)';
/** Medio lado de la caja de búsqueda local alrededor del punto de referencia (~16 km). */
const RADIO_LOCAL_GRADOS = 0.15;
/** Medio lado de la caja de prioridad (sin excluir resultados) para la búsqueda nacional (~55 km). */
const RADIO_PRIORIDAD_GRADOS = 0.5;

const ABREVIATURAS: [RegExp, string][] = [
  [/\b(?:bv|bvd|blvd)\.?(?=\s)/giu, 'Bulevar'],
  [/\bgral\.?(?=\s)/giu, 'General'],
  [/\bpje\.?(?=\s)/giu, 'Pasaje'],
  [/\bpte\.?(?=\s)/giu, 'Presidente'],
];

/** Expande abreviaturas de calles que Nominatim no interpreta. */
export function expandirAbreviaturas(texto: string): string {
  return ABREVIATURAS.reduce((t, [patron, completo]) => t.replace(patron, completo), texto);
}

interface ResultadoNominatim {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  address?: Record<string, string | undefined>;
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

/** Nombre corto para mostrar: "Avenida Colón 1234" si es una dirección; si no, el nombre del lugar. */
export function nombreDeResultado(d: ResultadoNominatim): string {
  const calle = d.address?.road?.trim();
  if (calle) {
    const numero = d.address?.house_number?.trim();
    return numero ? `${calle} ${numero}` : calle;
  }
  return d.name?.trim() || d.display_name.split(',')[0]!.trim();
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

  async buscar(consulta: string, opciones: OpcionesBusqueda = {}): Promise<Lugar[]> {
    const texto = expandirAbreviaturas(consulta.trim().replace(/\s+/g, ' '));
    if (!normalizarTexto(texto)) return [];
    // La referencia se redondea (~11 km) para que la caché sirva a búsquedas cercanas entre sí.
    const cerca = opciones.cerca
      ? {
          lat: Math.round(opciones.cerca.lat * 10) / 10,
          lng: Math.round(opciones.cerca.lng * 10) / 10,
        }
      : undefined;
    const clave = `${normalizarTexto(texto)}|${cerca ? `${cerca.lat},${cerca.lng}` : ''}`;
    const enCache = this.#cache.get(clave);
    if (enCache && enCache.vence > this.#o.ahora()) return enCache.lugares;

    // Los pedidos se encolan para respetar 1 pedido/segundo aunque lleguen juntos.
    const tarea = this.#cola.then(() => this.#pedir(clave, texto, cerca));
    this.#cola = tarea.catch(() => undefined);
    return tarea;
  }

  async #pedir(clave: string, texto: string, cerca: LatLng | undefined): Promise<Lugar[]> {
    // Otra solicitud en la cola pudo haber resuelto la misma consulta.
    const enCache = this.#cache.get(clave);
    if (enCache && enCache.vence > this.#o.ahora()) return enCache.lugares;

    // Direcciones (tienen altura): 1) solo cerca del punto de referencia; 2) si no hay nada, en todo
    // el país priorizando lo cercano. Barrios y ciudades (sin número): directo en todo el país con
    // prioridad, porque la búsqueda local encuentra calles homónimas ("Villa Carlos Paz" →
    // "Variante Carlos Paz" de Córdoba).
    const pidioAltura = /\d/.test(texto);
    let datos = cerca && pidioAltura ? await this.#consultar(texto, cerca, 'solo-cerca') : [];
    if (datos.length === 0) datos = await this.#consultar(texto, cerca, 'priorizar-cerca');

    const lugares = datos
      .map((d) => {
        // Si se pidió una altura y OpenStreetMap no la tiene, el punto es el de la calle: se avisa.
        const aproximada = pidioAltura && Boolean(d.address?.road) && !d.address?.house_number;
        return {
          nombre: nombreDeResultado(d),
          descripcion: aproximada
            ? `Ubicación aproximada (calle) · ${d.display_name}`
            : d.display_name,
          lat: Number.parseFloat(d.lat),
          lng: Number.parseFloat(d.lon),
        };
      })
      .filter((l) => Number.isFinite(l.lat) && Number.isFinite(l.lng));

    if (this.#cache.size >= this.#o.maxEntradasCache) {
      this.#cache.delete(this.#cache.keys().next().value!); // la más antigua
    }
    this.#cache.set(clave, { lugares, vence: this.#o.ahora() + this.#o.ttlCacheMs });
    return lugares;
  }

  /**
   * Un pedido a Nominatim (respeta 1 pedido/segundo). Con `cerca`: 'solo-cerca' filtra a la caja local
   * (bounded=1); 'priorizar-cerca' busca en todo el país ordenando primero lo cercano (bounded=0).
   */
  async #consultar(
    texto: string,
    cerca: LatLng | undefined,
    alcance: 'solo-cerca' | 'priorizar-cerca',
  ): Promise<ResultadoNominatim[]> {
    const espera = this.#ultimoPedido + this.#o.intervaloMinimoMs - this.#o.ahora();
    if (espera > 0) await this.#o.esperar(espera);
    this.#ultimoPedido = this.#o.ahora();

    const parametros = new URLSearchParams({
      q: texto,
      format: 'jsonv2',
      countrycodes: 'ar',
      addressdetails: '1',
      limit: '5',
      'accept-language': 'es',
    });
    if (cerca) {
      const r = alcance === 'solo-cerca' ? RADIO_LOCAL_GRADOS : RADIO_PRIORIDAD_GRADOS;
      const caja = [cerca.lng - r, cerca.lat + r, cerca.lng + r, cerca.lat - r];
      parametros.set('viewbox', caja.map((x) => Number(x.toFixed(4))).join(','));
      parametros.set('bounded', alcance === 'solo-cerca' ? '1' : '0');
    }
    const url = new URL(URL_NOMINATIM);
    url.search = parametros.toString();

    try {
      const respuesta = await this.#o.fetch(url, {
        headers: { 'User-Agent': USER_AGENT_NOMINATIM, Accept: 'application/json' },
        signal: AbortSignal.timeout(this.#o.timeoutMs),
      });
      if (!respuesta.ok) throw new Error(`Nominatim respondió ${respuesta.status}`);
      return (await respuesta.json()) as ResultadoNominatim[];
    } catch (error) {
      throw new GeocodificacionNoDisponibleError('La búsqueda de direcciones no está disponible.', {
        cause: error,
      });
    }
  }
}
