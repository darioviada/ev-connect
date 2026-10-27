// Proveedores de rutas: Offline con valores conocidos y Google con fetch simulado (sin red ni costo).
import { describe, expect, it, vi } from 'vitest';
import {
  AVISO_FALLBACK,
  CacheRutasMemoria,
  claveRuta,
  crearRoutingProvider,
  FIELD_MASK,
  GoogleRoutesProvider,
  haversineM,
  OfflineProvider,
  URL_ROUTE_MATRIX,
  velocidadMediaKmh,
  type LatLng,
} from '../../src/routing/index.js';

const CORDOBA: LatLng = { lat: -31.4201, lng: -64.1888 };
const CARLOS_PAZ: LatLng = { lat: -31.4241, lng: -64.4978 };
const ALTA_GRACIA: LatLng = { lat: -31.654, lng: -64.4284 };

describe('OfflineProvider', () => {
  it('Haversine: 1° de latitud ≈ 111.19 km', () => {
    expect(haversineM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111_195, -1);
    expect(haversineM(CORDOBA, CORDOBA)).toBe(0);
  });

  it('velocidad media por tramo: 30 km/h hasta 5 km, 40 hasta 25 km, 60 más allá', () => {
    expect(velocidadMediaKmh(5)).toBe(30);
    expect(velocidadMediaKmh(5.01)).toBe(40);
    expect(velocidadMediaKmh(25)).toBe(40);
    expect(velocidadMediaKmh(25.01)).toBe(60);
  });

  it('distancia = Haversine × 1.35 y duración según la velocidad media', async () => {
    const r = await new OfflineProvider().matrix([{ lat: 0, lng: 0 }], [{ lat: 1, lng: 0 }]);
    const celda = r.celdas[0]![0]!;
    expect(celda.distanciaM).toBe(Math.round(111_194.93 * 1.35));
    expect(celda.duracionS).toBeCloseTo((150.113 / 60) * 3600, -1); // ~150 km a 60 km/h
    expect(celda.fuente).toBe('offline-estimado');
    expect(r.elementosConsultados).toBe(0);
  });

  it('Córdoba → Villa Carlos Paz ≈ 29.3 km en línea recta, ≈ 39.6 km estimados', async () => {
    const r = await new OfflineProvider().matrix([CORDOBA], [CARLOS_PAZ]);
    expect(r.celdas[0]![0]!.distanciaM / 1000).toBeCloseTo(39.6, 0);
  });

  it('devuelve una matriz origen × destino', async () => {
    const r = await new OfflineProvider().matrix(
      [CORDOBA, CARLOS_PAZ],
      [CARLOS_PAZ, ALTA_GRACIA, CORDOBA],
    );
    expect(r.celdas).toHaveLength(2);
    expect(r.celdas.every((f) => f.length === 3)).toBe(true);
    expect(r.celdas[1]![0]!.distanciaM).toBe(0);
  });
});

/** fetch simulado que responde como la Routes API (elementos en orden arbitrario). */
function fetchGoogle(
  responder: (cuerpo: { origins: unknown[]; destinations: unknown[] }) => unknown[],
) {
  return vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const cuerpo = JSON.parse(String(init?.body));
    return new Response(JSON.stringify(responder(cuerpo)), { status: 200 });
  });
}

/** Todos los pares con ruta: distancia = 1000 × (i + 1) + j, duración = 60 s × (j + 1). */
const todoOk = (c: { origins: unknown[]; destinations: unknown[] }) =>
  c.origins
    .flatMap((_, i) =>
      c.destinations.map((_, j) => ({
        originIndex: i,
        destinationIndex: j,
        status: {},
        condition: 'ROUTE_EXISTS',
        distanceMeters: 1000 * (i + 1) + j,
        duration: `${60 * (j + 1)}s`,
      })),
    )
    .reverse();

describe('GoogleRoutesProvider (fetch simulado)', () => {
  it('pide con el endpoint, la clave, el field mask mínimo y TRAFFIC_UNAWARE', async () => {
    const fetch = fetchGoogle(todoOk);
    const google = new GoogleRoutesProvider({
      apiKey: 'CLAVE',
      cache: new CacheRutasMemoria(),
      fetch,
    });
    const r = await google.matrix([CORDOBA], [CARLOS_PAZ, ALTA_GRACIA]);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe(URL_ROUTE_MATRIX);
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({
      'X-Goog-Api-Key': 'CLAVE',
      'X-Goog-FieldMask': FIELD_MASK,
    });
    expect(FIELD_MASK).toBe(
      'originIndex,destinationIndex,duration,distanceMeters,status,condition',
    );
    const cuerpo = JSON.parse(String(init?.body));
    expect(cuerpo).toMatchObject({ travelMode: 'DRIVE', routingPreference: 'TRAFFIC_UNAWARE' });
    expect(cuerpo.origins[0]).toEqual({
      waypoint: { location: { latLng: { latitude: CORDOBA.lat, longitude: CORDOBA.lng } } },
    });

    expect(r.celdas[0]).toEqual([
      { distanciaM: 1000, duracionS: 60, fuente: 'google' },
      { distanciaM: 1001, duracionS: 120, fuente: 'google' },
    ]);
    expect(r.elementosConsultados).toBe(2);
    expect(r.advertencias).toEqual([]);
  });

  it('caché: la segunda consulta igual no llama a la API', async () => {
    const fetch = fetchGoogle(todoOk);
    const cache = new CacheRutasMemoria();
    const google = new GoogleRoutesProvider({ apiKey: 'k', cache, fetch });
    await google.matrix([CORDOBA], [CARLOS_PAZ, ALTA_GRACIA]);
    expect(cache.datos.has(claveRuta(CORDOBA, CARLOS_PAZ))).toBe(true);

    const r = await google.matrix([CORDOBA], [CARLOS_PAZ, ALTA_GRACIA]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(r.elementosConsultados).toBe(0);
    expect(r.elementosDesdeCache).toBe(2);
    expect(r.celdas[0]!.map((c) => c.fuente)).toEqual(['google-cache', 'google-cache']);
  });

  it('caché parcial: solo pide los destinos que faltan y ubica bien los índices', async () => {
    const cache = new CacheRutasMemoria();
    await cache.guardar(
      new Map([[claveRuta(CORDOBA, CARLOS_PAZ), { distanciaM: 5, duracionS: 5 }]]),
    );
    const fetch = fetchGoogle(todoOk);
    const google = new GoogleRoutesProvider({ apiKey: 'k', cache, fetch });

    const r = await google.matrix([CORDOBA], [CARLOS_PAZ, ALTA_GRACIA]);
    const cuerpo = JSON.parse(String(fetch.mock.calls[0]![1]?.body));
    expect(cuerpo.destinations).toHaveLength(1); // solo Alta Gracia
    expect(r.celdas[0]).toEqual([
      { distanciaM: 5, duracionS: 5, fuente: 'google-cache' },
      { distanciaM: 1000, duracionS: 60, fuente: 'google' },
    ]);
    expect(r.elementosConsultados).toBe(1);
    expect(r.elementosDesdeCache).toBe(1);
  });

  it.each([
    ['HTTP 500', vi.fn(async () => new Response('error', { status: 500 }))],
    ['sin red', vi.fn(async () => Promise.reject(new TypeError('fetch failed')))],
    ['respuesta no esperada', vi.fn(async () => new Response('{"error":{}}', { status: 200 }))],
  ])('error de la API (%s): cae a offline y avisa', async (_caso, fetch) => {
    const cache = new CacheRutasMemoria();
    const warn = vi.fn();
    const google = new GoogleRoutesProvider({
      apiKey: 'k',
      cache,
      fetch: fetch as unknown as typeof globalThis.fetch,
      logger: { info: vi.fn(), warn },
    });
    const r = await google.matrix([CORDOBA], [CARLOS_PAZ]);
    expect(r.celdas[0]![0]!.fuente).toBe('offline-estimado');
    expect(r.advertencias).toEqual([AVISO_FALLBACK]);
    expect(r.elementosConsultados).toBe(0);
    expect(cache.datos.size).toBe(0);
    expect(warn).toHaveBeenCalled();
  });

  it('par sin ruta: se estima offline; distancia omitida (0 m) se respeta', async () => {
    const fetch = fetchGoogle(() => [
      { originIndex: 0, destinationIndex: 0, status: {}, condition: 'ROUTE_NOT_FOUND' },
      {
        originIndex: 0,
        destinationIndex: 1,
        status: {},
        condition: 'ROUTE_EXISTS',
        duration: '0s',
      },
    ]);
    const google = new GoogleRoutesProvider({ apiKey: 'k', cache: new CacheRutasMemoria(), fetch });
    const r = await google.matrix([CORDOBA], [CARLOS_PAZ, CORDOBA]);
    expect(r.celdas[0]![0]!.fuente).toBe('offline-estimado');
    expect(r.celdas[0]![1]).toEqual({ distanciaM: 0, duracionS: 0, fuente: 'google' });
    expect(r.advertencias[0]).toMatch(/no tienen ruta/);
  });

  it('respeta el límite de 625 elementos por pedido (lotes de orígenes)', async () => {
    const fetch = fetchGoogle(todoOk);
    const google = new GoogleRoutesProvider({ apiKey: 'k', cache: new CacheRutasMemoria(), fetch });
    const puntos = (n: number, base: number) =>
      Array.from({ length: n }, (_, k) => ({ lat: base + k * 0.01, lng: -64 }));
    const r = await google.matrix(puntos(30, -31), puntos(30, -32));

    expect(fetch).toHaveBeenCalledTimes(2); // 20 + 10 orígenes × 30 destinos
    for (const [, init] of fetch.mock.calls) {
      const c = JSON.parse(String(init?.body));
      expect(c.origins.length * c.destinations.length).toBeLessThanOrEqual(625);
    }
    expect(r.elementosConsultados).toBe(900);
    expect(r.celdas[25]![3]).toEqual({
      distanciaM: 1000 * 6 + 3,
      duracionS: 240,
      fuente: 'google',
    });
  });
});

describe('crearRoutingProvider', () => {
  it('offline por defecto y google cuando la config lo resolvió así', () => {
    const cache = new CacheRutasMemoria();
    expect(crearRoutingProvider({ routing: { provider: 'offline' } }, { cache }).nombre).toBe(
      'offline',
    );
    expect(
      crearRoutingProvider({ routing: { provider: 'google', googleApiKey: 'k' } }, { cache })
        .nombre,
    ).toBe('google');
  });
});
