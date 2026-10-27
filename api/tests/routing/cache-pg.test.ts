// Caché de rutas sobre la tabla cache_ruta (base real) con TTL de 7 días.
import type { Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CacheRutasPg, CacheTrazadosPg } from '../../src/routing/index.js';
import { prepararBaseDePrueba } from '../db/baseDePrueba.js';

let db: Knex;
beforeAll(async () => {
  db = await prepararBaseDePrueba();
});
afterAll(async () => {
  await db?.('cache_ruta').where('clave', 'like', 'test:%').delete();
  await db?.('cache_trazado').where('clave', 'like', 'test:%').delete();
  await db?.destroy();
});

describe('CacheRutasPg', () => {
  it('guarda, actualiza y recupera entradas', async () => {
    const cache = new CacheRutasPg(db);
    await cache.guardar(new Map([['test:a', { distanciaM: 1000.4, duracionS: 60.6 }]]));
    expect((await cache.obtener(['test:a', 'test:no-existe'])).get('test:a')).toEqual({
      distanciaM: 1000,
      duracionS: 61,
    });
    await cache.guardar(new Map([['test:a', { distanciaM: 2000, duracionS: 120 }]]));
    expect((await cache.obtener(['test:a'])).get('test:a')?.distanciaM).toBe(2000);
    expect((await cache.obtener([])).size).toBe(0);
  });

  it('ignora entradas vencidas (más de 7 días)', async () => {
    const cache = new CacheRutasPg(db);
    await cache.guardar(new Map([['test:viejo', { distanciaM: 1, duracionS: 1 }]]));
    await db('cache_ruta')
      .where('clave', 'test:viejo')
      .update({ creado: db.raw("now() - interval '8 days'") });
    expect((await cache.obtener(['test:viejo'])).has('test:viejo')).toBe(false);
  });
});

describe('CacheTrazadosPg', () => {
  it('guarda y recupera trazados, e ignora los vencidos', async () => {
    const cache = new CacheTrazadosPg(db);
    await cache.guardar('test:t', { polyline: 'abc', distanciaM: 1000.4, duracionS: 60.6 });
    expect(await cache.obtener('test:t')).toEqual({
      polyline: 'abc',
      distanciaM: 1000,
      duracionS: 61,
    });
    await db('cache_trazado')
      .where('clave', 'test:t')
      .update({ creado: db.raw("now() - interval '8 days'") });
    expect(await cache.obtener('test:t')).toBeUndefined();
  });
});
