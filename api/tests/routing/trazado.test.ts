// Trazado de rutas (computeRoutes) para dibujar el camino real en el mapa: fetch simulado, sin red ni costo.
import { describe, expect, it, vi } from 'vitest';
import {
  CacheRutasMemoria,
  CacheTrazadosMemoria,
  decodificarPolyline,
  FIELD_MASK_TRAZADO,
  GoogleRoutesProvider,
  OfflineProvider,
  URL_COMPUTE_ROUTES,
} from '../../src/routing/index.js';

const CORDOBA = { lat: -31.4201, lng: -64.1888 };
const CARLOS_PAZ = { lat: -31.4241, lng: -64.4978 };
// Ejemplo de la documentación oficial del algoritmo "Encoded Polyline" de Google
const EJEMPLO = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';

describe('decodificarPolyline', () => {
  it('decodifica el ejemplo oficial', () => {
    expect(decodificarPolyline(EJEMPLO)).toEqual([
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ]);
  });

  it('una polyline vacía no tiene puntos; una truncada es un error', () => {
    expect(decodificarPolyline('')).toEqual([]);
    expect(() => decodificarPolyline('_p~iF~ps|')).toThrow(/inválida/);
  });
});

const respuestaRuta = () =>
  new Response(
    JSON.stringify({
      routes: [
        { polyline: { encodedPolyline: EJEMPLO }, distanceMeters: 36500, duration: '2400s' },
      ],
    }),
    { status: 200 },
  );

describe('GoogleRoutesProvider.trazado', () => {
  it('pide computeRoutes con field mask mínimo y sin tráfico (Essentials)', async () => {
    const fetch = vi.fn(async () => respuestaRuta());
    const google = new GoogleRoutesProvider({
      apiKey: 'CLAVE',
      cache: new CacheRutasMemoria(),
      fetch: fetch as unknown as typeof globalThis.fetch,
    });
    const t = await google.trazado(CORDOBA, CARLOS_PAZ);

    const [url, init] = fetch.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toBe(URL_COMPUTE_ROUTES);
    expect(init.headers).toMatchObject({
      'X-Goog-Api-Key': 'CLAVE',
      'X-Goog-FieldMask': FIELD_MASK_TRAZADO,
    });
    const cuerpo = JSON.parse(String(init.body));
    expect(cuerpo).toMatchObject({
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_UNAWARE',
      polylineQuality: 'OVERVIEW',
      polylineEncoding: 'ENCODED_POLYLINE',
      origin: { location: { latLng: { latitude: CORDOBA.lat, longitude: CORDOBA.lng } } },
    });
    expect(cuerpo).not.toHaveProperty('intermediates'); // con paradas intermedias cambia de categoría
    expect(t).toEqual({
      puntos: decodificarPolyline(EJEMPLO),
      distanciaM: 36500,
      duracionS: 2400,
      fuente: 'google',
    });
  });

  it('la segunda consulta sale de la caché', async () => {
    const fetch = vi.fn(async () => respuestaRuta());
    const cacheTrazados = new CacheTrazadosMemoria();
    const google = new GoogleRoutesProvider({
      apiKey: 'k',
      cache: new CacheRutasMemoria(),
      cacheTrazados,
      fetch: fetch as unknown as typeof globalThis.fetch,
    });
    await google.trazado(CORDOBA, CARLOS_PAZ);
    const t = await google.trazado(CORDOBA, CARLOS_PAZ);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(t?.fuente).toBe('google-cache');
  });

  it.each([
    ['error HTTP', vi.fn(async () => new Response('', { status: 403 }))],
    ['sin red', vi.fn(async () => Promise.reject(new TypeError('fetch failed')))],
    ['sin ruta por calles', vi.fn(async () => new Response('{}', { status: 200 }))],
  ])('%s → null (la interfaz dibuja una recta)', async (_caso, fetch) => {
    const warn = vi.fn();
    const google = new GoogleRoutesProvider({
      apiKey: 'k',
      cache: new CacheRutasMemoria(),
      fetch: fetch as unknown as typeof globalThis.fetch,
      logger: { info: vi.fn(), warn },
    });
    expect(await google.trazado(CORDOBA, CARLOS_PAZ)).toBeNull();
  });

  it('el proveedor offline no calcula trazado', async () => {
    expect(await new OfflineProvider().trazado()).toBeNull();
  });
});
