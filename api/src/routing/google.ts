// GoogleRoutesProvider — Routes API v2, método computeRouteMatrix.
// Verificado en la documentación oficial (2026-10-27):
//   POST https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix
//   Encabezados: X-Goog-Api-Key, X-Goog-FieldMask; respuesta: arreglo JSON de elementos
//   { originIndex, destinationIndex, status, condition, distanceMeters, duration: "123s" }.
// Control de costo:
//   - field mask mínimo (índices, distancia, duración, estado, condición);
//   - routingPreference TRAFFIC_UNAWARE (nivel de precio más bajo; el análisis de costos del informe lo supone);
//   - caché de 7 días en cache_ruta; solo se piden los pares que no están en caché;
//   - se cuentan y loguean los elementos consultados.
// Si la API falla, se cae al OfflineProvider para los pares faltantes y se avisa en `advertencias`.
import type { Logger } from 'pino';
import { claveRuta, type CacheRutas, type EntradaCache } from './cache.js';
import { estimarCelda } from './offline.js';
import type { Celda, LatLng, ResultadoMatriz, RoutingProvider } from './tipos.js';

export const URL_ROUTE_MATRIX =
  'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix';
export const FIELD_MASK = 'originIndex,destinationIndex,duration,distanceMeters,status,condition';
/** Límite de elementos por pedido para rutas que no son de transporte público. */
const MAX_ELEMENTOS = 625;

export const AVISO_FALLBACK =
  'No se pudo consultar Google Routes: distancias y tiempos estimados en modo offline.';

interface ElementoRespuesta {
  originIndex?: number;
  destinationIndex?: number;
  status?: { code?: number; message?: string };
  condition?: string;
  distanceMeters?: number;
  duration?: string;
}

export interface OpcionesGoogle {
  apiKey: string;
  cache: CacheRutas;
  fetch?: typeof fetch;
  logger?: Pick<Logger, 'info' | 'warn'>;
  timeoutMs?: number;
}

const waypoint = (p: LatLng) => ({
  waypoint: { location: { latLng: { latitude: p.lat, longitude: p.lng } } },
});

export class GoogleRoutesProvider implements RoutingProvider {
  readonly nombre = 'google' as const;
  readonly #o: Required<Omit<OpcionesGoogle, 'logger'>> & Pick<OpcionesGoogle, 'logger'>;

  constructor(opciones: OpcionesGoogle) {
    this.#o = { fetch: globalThis.fetch, timeoutMs: 8000, ...opciones };
  }

  async matrix(origenes: readonly LatLng[], destinos: readonly LatLng[]): Promise<ResultadoMatriz> {
    const celdas: (Celda | undefined)[][] = origenes.map(() => destinos.map(() => undefined));
    const claves = origenes.map((o) => destinos.map((d) => claveRuta(o, d)));

    // 1. Caché
    const enCache = await this.#o.cache.obtener([...new Set(claves.flat())]);
    let elementosDesdeCache = 0;
    claves.forEach((fila, i) =>
      fila.forEach((clave, j) => {
        const e = enCache.get(clave);
        if (e) {
          celdas[i]![j] = { ...e, fuente: 'google-cache' };
          elementosDesdeCache++;
        }
      }),
    );

    // 2. Pares faltantes: se piden solo los orígenes y destinos involucrados.
    const filas = origenes.map((_, i) => i).filter((i) => celdas[i]!.some((c) => !c));
    const columnas = destinos.map((_, j) => j).filter((j) => filas.some((i) => !celdas[i]![j]));
    let elementosConsultados = 0;
    const advertencias: string[] = [];

    if (filas.length > 0) {
      try {
        const nuevos = new Map<string, EntradaCache>();
        for (const lote of lotes(filas, Math.max(1, Math.floor(MAX_ELEMENTOS / columnas.length)))) {
          const elementos = await this.#pedir(
            lote.map((i) => origenes[i]!),
            columnas.map((j) => destinos[j]!),
          );
          elementosConsultados += lote.length * columnas.length;
          for (const el of elementos) {
            const i = lote[el.originIndex ?? 0];
            const j = columnas[el.destinationIndex ?? 0];
            if (i === undefined || j === undefined) continue;
            const ok = (el.status?.code ?? 0) === 0 && el.condition === 'ROUTE_EXISTS';
            if (!ok) continue; // queda sin celda → se estima offline más abajo
            // En JSON (proto3) los valores 0 se omiten: distancia ausente = 0 m.
            const entrada = {
              distanciaM: el.distanceMeters ?? 0,
              duracionS: Number.parseFloat(el.duration ?? '0'),
            };
            if (!celdas[i]![j]) celdas[i]![j] = { ...entrada, fuente: 'google' };
            nuevos.set(claves[i]![j]!, entrada);
          }
        }
        await this.#o.cache.guardar(nuevos);
        this.#o.logger?.info(
          { elementosConsultados, elementosDesdeCache },
          'Routes API: elementos consultados',
        );
      } catch (error) {
        this.#o.logger?.warn({ err: error }, 'Routes API no disponible: se usa el modo offline');
        advertencias.push(AVISO_FALLBACK);
      }
    }

    // 3. Lo que siga faltando (error de la API o par sin ruta) se estima offline.
    let estimadas = 0;
    const completas = celdas.map((fila, i) =>
      fila.map((c, j) => {
        if (c) return c;
        estimadas++;
        return estimarCelda(origenes[i]!, destinos[j]!);
      }),
    );
    if (estimadas > 0 && advertencias.length === 0) {
      advertencias.push(
        'Algunos trayectos no tienen ruta en Google: se estimaron en modo offline.',
      );
    }

    return { celdas: completas, elementosConsultados, elementosDesdeCache, advertencias };
  }

  async #pedir(origenes: LatLng[], destinos: LatLng[]): Promise<ElementoRespuesta[]> {
    const respuesta = await this.#o.fetch(URL_ROUTE_MATRIX, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.#o.apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({
        origins: origenes.map(waypoint),
        destinations: destinos.map(waypoint),
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_UNAWARE',
      }),
      signal: AbortSignal.timeout(this.#o.timeoutMs),
    });
    if (!respuesta.ok) {
      throw new Error(`Routes API respondió ${respuesta.status}`);
    }
    const cuerpo: unknown = await respuesta.json();
    if (!Array.isArray(cuerpo)) throw new Error('Respuesta inesperada de Routes API');
    return cuerpo as ElementoRespuesta[];
  }
}

function lotes<T>(lista: T[], tamano: number): T[][] {
  const resultado: T[][] = [];
  for (let i = 0; i < lista.length; i += tamano) resultado.push(lista.slice(i, i + tamano));
  return resultado;
}
