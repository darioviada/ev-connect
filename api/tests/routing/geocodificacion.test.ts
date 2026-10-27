// Geocodificación: lista fija y proxy a Nominatim (fetch simulado; nunca se llama al servicio real).
import { describe, expect, it, vi } from 'vitest';
import {
  crearGeocodingProvider,
  GeocodificacionNoDisponibleError,
  LUGARES,
  NominatimProvider,
  StaticGeocodingProvider,
  URL_NOMINATIM,
  USER_AGENT_NOMINATIM,
} from '../../src/routing/geocodificacion/index.js';

describe('StaticGeocodingProvider', () => {
  const geo = new StaticGeocodingProvider();

  it('tiene alcance nacional (barrios de Córdoba y ciudades del país)', () => {
    expect(LUGARES.length).toBeGreaterThanOrEqual(15);
    const provincias = new Set(LUGARES.map((l) => l.descripcion.split(', ').at(-1)));
    expect(provincias.size).toBeGreaterThan(5);
  });

  it('busca sin distinguir acentos ni mayúsculas', async () => {
    expect((await geo.buscar('nueva cordoba'))[0]?.nombre).toBe('Nueva Córdoba');
    expect((await geo.buscar('GUEMES'))[0]?.nombre).toBe('Güemes');
    expect((await geo.buscar('  rosario '))[0]?.descripcion).toBe('Rosario, Santa Fe');
  });

  it('exige todas las palabras y prioriza los que empiezan con la consulta', async () => {
    const r = await geo.buscar('carlos paz');
    expect(r.map((l) => l.nombre)).toEqual(['Villa Carlos Paz']);
    const cordoba = await geo.buscar('córdoba');
    expect(cordoba[0]?.nombre).toBe('Córdoba Centro');
    expect(cordoba.length).toBeLessThanOrEqual(8);
  });

  it('consulta vacía o sin coincidencias → lista vacía', async () => {
    expect(await geo.buscar('   ')).toEqual([]);
    expect(await geo.buscar('atlantida')).toEqual([]);
  });
});

/** Reloj simulado: `esperar` adelanta el tiempo en lugar de dormir. */
function relojSimulado() {
  let t = 1_000_000;
  return {
    ahora: () => t,
    esperar: vi.fn(async (ms: number) => {
      t += ms;
    }),
    avanzar: (ms: number) => {
      t += ms;
    },
  };
}

const respuestaNominatim = () =>
  new Response(
    JSON.stringify([
      {
        lat: '-31.4201',
        lon: '-64.1888',
        name: 'Córdoba',
        display_name: 'Córdoba, Pedanía Capital, Córdoba, Argentina',
      },
      { lat: 'x', lon: 'y', display_name: 'Inválido' },
    ]),
    { status: 200 },
  );

describe('NominatimProvider (fetch simulado)', () => {
  it('usa /search con jsonv2, countrycodes=ar y un User-Agent propio', async () => {
    const fetch = vi.fn(async () => respuestaNominatim());
    const geo = new NominatimProvider({
      fetch: fetch as unknown as typeof globalThis.fetch,
      ...relojSimulado(),
    });
    const r = await geo.buscar('Córdoba');

    const [url, init] = fetch.mock.calls[0]! as unknown as [URL, RequestInit];
    expect(`${url.origin}${url.pathname}`).toBe(URL_NOMINATIM);
    expect(url.searchParams.get('format')).toBe('jsonv2');
    expect(url.searchParams.get('countrycodes')).toBe('ar');
    expect(url.searchParams.get('q')).toBe('cordoba');
    expect(init.headers).toMatchObject({ 'User-Agent': USER_AGENT_NOMINATIM });
    expect(r).toEqual([
      {
        nombre: 'Córdoba',
        descripcion: 'Córdoba, Pedanía Capital, Córdoba, Argentina',
        lat: -31.4201,
        lng: -64.1888,
      },
    ]);
  });

  it('cachea: la misma consulta no vuelve a llamar al servicio', async () => {
    const fetch = vi.fn(async () => respuestaNominatim());
    const geo = new NominatimProvider({
      fetch: fetch as unknown as typeof globalThis.fetch,
      ...relojSimulado(),
    });
    await geo.buscar('Córdoba');
    await geo.buscar('cordoba ');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('respeta 1 pedido por segundo aunque las consultas lleguen juntas', async () => {
    const reloj = relojSimulado();
    const momentos: number[] = [];
    const fetch = vi.fn(async () => {
      momentos.push(reloj.ahora());
      return respuestaNominatim();
    });
    const geo = new NominatimProvider({
      fetch: fetch as unknown as typeof globalThis.fetch,
      ...reloj,
    });
    await Promise.all([geo.buscar('a'), geo.buscar('b'), geo.buscar('c')]);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(momentos[1]! - momentos[0]!).toBeGreaterThanOrEqual(1000);
    expect(momentos[2]! - momentos[1]!).toBeGreaterThanOrEqual(1000);
  });

  it('si el servicio falla, lanza GeocodificacionNoDisponibleError y sigue funcionando después', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(respuestaNominatim());
    const geo = new NominatimProvider({ fetch, ...relojSimulado() });
    await expect(geo.buscar('x')).rejects.toBeInstanceOf(GeocodificacionNoDisponibleError);
    await expect(geo.buscar('y')).resolves.toHaveLength(1);
  });
});

describe('crearGeocodingProvider', () => {
  it('elige según GEOCODING_PROVIDER', () => {
    expect(crearGeocodingProvider({ geocoding: { provider: 'static' } }).nombre).toBe('static');
    expect(crearGeocodingProvider({ geocoding: { provider: 'nominatim' } }).nombre).toBe(
      'nominatim',
    );
  });
});
