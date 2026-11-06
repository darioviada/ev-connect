// Geocodificación: lista fija y proxy a Nominatim (fetch simulado; nunca se llama al servicio real).
import { describe, expect, it, vi } from 'vitest';
import {
  crearGeocodingProvider,
  GeocodificacionNoDisponibleError,
  LUGARES,
  expandirAbreviaturas,
  nombreDeResultado,
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
    expect(url.searchParams.get('q')).toBe('Córdoba');
    expect(url.searchParams.get('addressdetails')).toBe('1');
    expect(url.searchParams.has('viewbox')).toBe(false);
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

describe('Nominatim: direcciones', () => {
  it('muestra "Calle número" para una dirección y el nombre para un lugar', () => {
    expect(
      nombreDeResultado({
        lat: '0',
        lon: '0',
        display_name: '1234, Avenida Colón, Alberdi, Córdoba, Argentina',
        address: { house_number: '1234', road: 'Avenida Colón', suburb: 'Alberdi' },
      }),
    ).toBe('Avenida Colón 1234');
    expect(
      nombreDeResultado({
        lat: '0',
        lon: '0',
        display_name: 'x',
        address: { road: 'Bv. San Juan' },
      }),
    ).toBe('Bv. San Juan');
    expect(
      nombreDeResultado({ lat: '0', lon: '0', name: 'Rosario', display_name: 'Rosario, Santa Fe' }),
    ).toBe('Rosario');
    expect(nombreDeResultado({ lat: '0', lon: '0', display_name: 'Paraná, Entre Ríos' })).toBe(
      'Paraná',
    );
  });

  it('busca primero cerca del punto de referencia (viewbox lon1,lat1,lon2,lat2 con bounded=1)', async () => {
    const fetch = vi.fn(async () => respuestaNominatim());
    const geo = new NominatimProvider({
      fetch: fetch as unknown as typeof globalThis.fetch,
      ...relojSimulado(),
    });
    await geo.buscar('Colón 1234', { cerca: { lat: -31.4201, lng: -64.1888 } });
    expect(fetch).toHaveBeenCalledTimes(1); // hubo resultados locales: no hace falta el segundo paso
    const [url] = fetch.mock.calls[0]! as unknown as [URL];
    // referencia redondeada a 0,1° (−31,4; −64,2) ± 0,15°
    expect(url.searchParams.get('viewbox')).toBe('-64.35,-31.25,-64.05,-31.55');
    expect(url.searchParams.get('bounded')).toBe('1');
    expect(url.searchParams.get('q')).toBe('Colón 1234');
  });

  it('si no hay resultados cerca, busca en todo el país respetando 1 pedido por segundo', async () => {
    const reloj = relojSimulado();
    const momentos: number[] = [];
    const fetch = vi
      .fn()
      .mockImplementationOnce(async () => {
        momentos.push(reloj.ahora());
        return new Response('[]', { status: 200 });
      })
      .mockImplementationOnce(async () => {
        momentos.push(reloj.ahora());
        return respuestaNominatim();
      });
    const geo = new NominatimProvider({ fetch, ...reloj });
    const r = await geo.buscar('San Martín 100, Rosario', { cerca: { lat: -31.42, lng: -64.19 } });
    expect(fetch).toHaveBeenCalledTimes(2);
    const [segunda] = fetch.mock.calls[1]! as unknown as [URL];
    expect(segunda.searchParams.has('viewbox')).toBe(false);
    expect(momentos[1]! - momentos[0]!).toBeGreaterThanOrEqual(1000);
    expect(r).toHaveLength(1);
  });

  it('expande abreviaturas de calles ("Bv" → "Bulevar", "Gral" → "General")', async () => {
    expect(expandirAbreviaturas('Bv San Juan 500')).toBe('Bulevar San Juan 500');
    expect(expandirAbreviaturas('bv. san juan 500')).toBe('Bulevar san juan 500');
    expect(expandirAbreviaturas('Gral Paz 100')).toBe('General Paz 100');
    expect(expandirAbreviaturas('Pje Santa Fe 10')).toBe('Pasaje Santa Fe 10');
    expect(expandirAbreviaturas('Bvlgari 3')).toBe('Bvlgari 3');
    const fetch = vi.fn(async () => respuestaNominatim());
    const geo = new NominatimProvider({
      fetch: fetch as unknown as typeof globalThis.fetch,
      ...relojSimulado(),
    });
    await geo.buscar('Bv San Juan 500');
    const [url] = fetch.mock.calls[0]! as unknown as [URL];
    expect(url.searchParams.get('q')).toBe('Bulevar San Juan 500');
  });

  it('avisa cuando se pidió una altura y solo se encontró la calle', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify([
            {
              lat: '-31.43',
              lon: '-64.19',
              display_name: 'Boulevard San Juan, Güemes, Córdoba',
              address: { road: 'Boulevard San Juan' },
            },
          ]),
          { status: 200 },
        ),
    );
    const geo = new NominatimProvider({
      fetch: fetch as unknown as typeof globalThis.fetch,
      ...relojSimulado(),
    });
    const [lugar] = await geo.buscar('Bulevar San Juan 500');
    expect(lugar!.nombre).toBe('Boulevard San Juan');
    expect(lugar!.descripcion).toMatch(/^Ubicación aproximada \(calle\)/);
  });

  it('la caché distingue la referencia de cercanía', async () => {
    const fetch = vi.fn(async () => respuestaNominatim());
    const geo = new NominatimProvider({
      fetch: fetch as unknown as typeof globalThis.fetch,
      ...relojSimulado(),
    });
    await geo.buscar('San Martín 100', { cerca: { lat: -31.42, lng: -64.19 } });
    await geo.buscar('San Martín 100', { cerca: { lat: -31.43, lng: -64.18 } }); // misma zona → caché
    await geo.buscar('San Martín 100', { cerca: { lat: -32.95, lng: -60.64 } }); // Rosario → nuevo pedido
    expect(fetch).toHaveBeenCalledTimes(2);
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
