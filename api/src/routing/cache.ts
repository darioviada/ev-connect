// Caché de resultados de la Routes API (tabla cache_ruta): evita pagar dos veces el mismo trayecto.
// Clave: coordenadas redondeadas a 4 decimales (~11 m). TTL: 7 días.
import type { Knex } from 'knex';
import type { LatLng } from './tipos.js';

export interface EntradaCache {
  distanciaM: number;
  duracionS: number;
}

export interface CacheRutas {
  obtener(claves: readonly string[]): Promise<Map<string, EntradaCache>>;
  guardar(entradas: ReadonlyMap<string, EntradaCache>): Promise<void>;
}

const r4 = (x: number) => x.toFixed(4);
export function claveRuta(origen: LatLng, destino: LatLng): string {
  return `${r4(origen.lat)},${r4(origen.lng)}>${r4(destino.lat)},${r4(destino.lng)}`;
}

export const TTL_CACHE_DIAS = 7;

export class CacheRutasPg implements CacheRutas {
  readonly #db: Knex;
  readonly #ttlDias: number;

  constructor(db: Knex, ttlDias = TTL_CACHE_DIAS) {
    this.#db = db;
    this.#ttlDias = ttlDias;
  }

  async obtener(claves: readonly string[]): Promise<Map<string, EntradaCache>> {
    if (claves.length === 0) return new Map();
    const filas = await this.#db('cache_ruta')
      .whereIn('clave', claves)
      .andWhereRaw('creado > now() - make_interval(days => ?)', [this.#ttlDias])
      .select('clave', 'distancia_m', 'duracion_s');
    return new Map(
      filas.map((f: { clave: string; distancia_m: number; duracion_s: number }) => [
        f.clave,
        { distanciaM: f.distancia_m, duracionS: f.duracion_s },
      ]),
    );
  }

  async guardar(entradas: ReadonlyMap<string, EntradaCache>): Promise<void> {
    if (entradas.size === 0) return;
    await this.#db('cache_ruta')
      .insert(
        [...entradas].map(([clave, e]) => ({
          clave,
          distancia_m: Math.round(e.distanciaM),
          duracion_s: Math.round(e.duracionS),
          creado: this.#db.fn.now(),
        })),
      )
      .onConflict('clave')
      .merge();
  }
}

/** Caché en memoria (tests y uso sin base). */
export class CacheRutasMemoria implements CacheRutas {
  readonly datos = new Map<string, EntradaCache>();

  async obtener(claves: readonly string[]) {
    return new Map(
      claves.filter((c) => this.datos.has(c)).map((c) => [c, this.datos.get(c)!] as const),
    );
  }

  async guardar(entradas: ReadonlyMap<string, EntradaCache>) {
    for (const [c, e] of entradas) this.datos.set(c, e);
  }
}
