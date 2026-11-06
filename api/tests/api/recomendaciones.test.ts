// POST /recomendaciones de punta a punta con el seed (preselección espacial + proveedor offline + motor).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { uuidDeterministico } from '../../seeds/aleatorio.js';
import { preseleccionar } from '../../src/modules/recomendaciones/preseleccion.js';
import { haversineM, OfflineProvider } from '../../src/routing/index.js';
import { appDePrueba } from '../helpers.js';
import { cliente, prepararContextoApi, tokenSeed, type ContextoApi } from './contexto.js';

let ctx: ContextoApi;
beforeAll(async () => {
  ctx = await prepararContextoApi();
});
afterAll(async () => {
  await ctx?.db.destroy();
});

const CENTRO = { lat: -31.4201, lng: -64.1888 };
const CARLOS_PAZ = { lat: -31.4241, lng: -64.4978 };
const BUENOS_AIRES = { lat: -34.6037, lng: -58.3816 };
const MENDOZA = { lat: -32.8895, lng: -68.8458 };
const modelo = (clave: string) => ({ modeloId: uuidDeterministico(`modelo:${clave}`) });

const buscar = (body: object, token?: string) =>
  cliente(ctx.app, token).post('/recomendaciones', body);

describe('modo ubicación', () => {
  it('invitado con un modelo del catálogo: resultados ordenados con métricas (≤ 1 s)', async () => {
    const inicio = performance.now();
    const res = await buscar({
      vehiculo: modelo('peugeot-e208'),
      bateriaPct: 45,
      modo: 'ubicacion',
      origen: CENTRO,
    });
    const ms = performance.now() - inicio;

    expect(res.status).toBe(200);
    expect(ms).toBeLessThan(1000); // SPEC §14
    const r = res.body;
    expect(r).toMatchObject({
      urgencia: 'media',
      proveedorRutas: 'offline',
      modo: 'ubicacion',
      sinResultados: null,
    });
    expect(r.vehiculo.descripcion).toBe('Peugeot e-208');
    expect(r.meta.candidatosEvaluados).toBeGreaterThan(0);
    expect(r.meta.candidatosEvaluados).toBeLessThanOrEqual(8);
    expect(r.meta.elementosConsultados).toBe(0); // offline: sin costo
    expect(r.recomendaciones.length).toBeGreaterThan(0);
    expect(r.recomendaciones[0].mejorOpcion).toBe(true);
    const scores = r.recomendaciones.map((x: { score: number }) => x.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    expect(r.recomendaciones[0].metricas).toEqual(
      expect.objectContaining({
        distanciaKm: expect.any(Number),
        esperaMin: expect.any(Number),
        cargaMin: expect.any(Number),
        costoEstimado: expect.any(Number),
        horarioCarga: expect.objectContaining({ fecha: '2026-10-27' }),
      }),
    );
    expect(r.recomendaciones[0].desglose.distancia).toHaveProperty('aporte');
  });

  it('preselecciona solo conectores compatibles (Nissan Leaf → CHAdeMO)', async () => {
    const res = await buscar({
      vehiculo: modelo('nissan-leaf'),
      bateriaPct: 60,
      modo: 'ubicacion',
      origen: CENTRO,
    });
    expect(res.status).toBe(200);
    expect(res.body.recomendaciones.length).toBeGreaterThan(0);
    expect(
      res.body.recomendaciones.every(
        (x: { cargador: { tipoConector: string } }) => x.cargador.tipoConector === 'CHADEMO',
      ),
    ).toBe(true);
    expect(
      res.body.descartados.every((d: { motivo: string }) => d.motivo !== 'CONECTOR_INCOMPATIBLE'),
    ).toBe(true);
  });

  it('los cargadores inactivos no se recomiendan', async () => {
    const inactivos = await ctx.db('cargador').where('estado', 'inactivo').pluck('id');
    const res = await buscar({
      vehiculo: modelo('peugeot-e208'),
      bateriaPct: 90,
      modo: 'ubicacion',
      origen: CENTRO,
    });
    const ids = [
      ...res.body.recomendaciones.map((x: { cargador: { id: string } }) => x.cargador.id),
      ...res.body.descartados.map((d: { cargadorId: string }) => d.cargadorId),
    ];
    expect(ids.some((id: string) => inactivos.includes(id))).toBe(false);
  });

  it('sin cargadores en la zona → SIN_CARGADORES_CERCANOS (radio ampliado una vez)', async () => {
    const ushuaia = { lat: -54.8019, lng: -68.303 };
    const res = await buscar({
      vehiculo: modelo('peugeot-e208'),
      bateriaPct: 50,
      modo: 'ubicacion',
      origen: ushuaia,
    });
    expect(res.status).toBe(200);
    expect(res.body.sinResultados.codigo).toBe('SIN_CARGADORES_CERCANOS');
    expect(res.body.meta).toMatchObject({
      preseleccionAmpliada: true,
      distanciaPreseleccionKm: 40,
    });
  });

  it('vehículo personalizado sin carga DC solo recibe Tipo 2', async () => {
    const res = await buscar({
      vehiculo: {
        personalizado: {
          marca: 'Casero',
          modelo: 'Eléctrico',
          capacidadBateriaKwh: 30,
          consumoKwhPor100km: 14,
          tipoConector: 'TIPO_2',
          potenciaMaxAcKw: 7,
          potenciaMaxDcKw: null,
        },
      },
      bateriaPct: 50,
      modo: 'ubicacion',
      origen: CENTRO,
    });
    expect(res.status).toBe(200);
    expect(
      res.body.recomendaciones.every(
        (x: { cargador: { tipoConector: string } }) => x.cargador.tipoConector === 'TIPO_2',
      ),
    ).toBe(true);
  });
});

describe('vehículo guardado del usuario', () => {
  const vehiculoUsuario = { vehiculoUsuarioId: uuidDeterministico('vehiculo:usuario:1') };

  it('el dueño puede usarlo', async () => {
    const res = await buscar(
      { vehiculo: vehiculoUsuario, bateriaPct: 30, modo: 'ubicacion', origen: CENTRO },
      tokenSeed('usuario'),
    );
    expect(res.status).toBe(200);
    expect(res.body.vehiculo.descripcion).toBe('Peugeot e-208');
  });

  it('un invitado recibe 401 y otro usuario 404', async () => {
    const invitado = await buscar({
      vehiculo: vehiculoUsuario,
      bateriaPct: 30,
      modo: 'ubicacion',
      origen: CENTRO,
    });
    expect(invitado.status).toBe(401);
    const otro = await buscar(
      { vehiculo: vehiculoUsuario, bateriaPct: 30, modo: 'ubicacion', origen: CENTRO },
      tokenSeed('admin'),
    );
    expect(otro.status).toBe(404);
    expect(otro.body.error.code).toBe('VEHICULO_NO_ENCONTRADO');
  });
});

describe('modo ruta (Córdoba → Villa Carlos Paz)', () => {
  it('recomienda sobre el corredor con desvío y candidatos repartidos a lo largo de la ruta (D-025)', async () => {
    const res = await buscar({
      vehiculo: modelo('volvo-ex30'),
      bateriaPct: 50,
      modo: 'ruta',
      origen: CENTRO,
      destino: CARLOS_PAZ,
    });
    expect(res.status).toBe(200);
    const r = res.body;
    expect(r.modo).toBe('ruta');
    expect(r.recomendaciones.length).toBeGreaterThan(0);
    for (const rec of r.recomendaciones) {
      expect(rec.metricas.desvioKm).toEqual(expect.any(Number));
      expect(rec.metricas.desvioKm).toBeGreaterThanOrEqual(0);
    }
    // Con la preselección por tramos entran cargadores lejos del centro (camino a Carlos Paz).
    const evaluados = [...r.recomendaciones.map((x: { cargador: unknown }) => x.cargador)];
    const lngs = evaluados.map((c: { ubicacion: { lng: number } }) => c.ubicacion.lng);
    expect(Math.min(...lngs)).toBeLessThan(-64.3);
  });

  it('con poca batería solo ofrece cargadores alcanzables: el primer tramo entra en la autonomía (D-044)', async () => {
    // Volvo EX30 al 10 %: 38,3 km de autonomía, pero llegar con ≥ 5 % limita el alcance a ~19,2 km.
    const res = await buscar({
      vehiculo: modelo('volvo-ex30'),
      bateriaPct: 10,
      modo: 'ruta',
      origen: CENTRO,
      destino: CARLOS_PAZ,
    });
    expect(res.status).toBe(200);
    const r = res.body;
    expect(r.recomendaciones.length).toBeGreaterThan(0);
    for (const rec of r.recomendaciones) {
      expect(rec.metricas.distanciaKm).toBeLessThanOrEqual(19.2);
      expect(rec.metricas.socLlegadaPct).toBeGreaterThanOrEqual(5);
    }
  });

  it('la preselección con alcance deja afuera lo que está más lejos (en línea recta) que el alcance', async () => {
    const base = {
      modo: 'ruta' as const,
      origen: CENTRO,
      destino: CARLOS_PAZ,
      conectores: ['CCS_COMBO', 'TIPO_2'] as const,
      radioKm: 10,
      corredorKm: 5,
      limite: 8,
    };
    const sinAlcance = await preseleccionar(ctx.db, base);
    const conAlcance = await preseleccionar(ctx.db, { ...base, alcanceKm: 12 });
    const lejos = (f: { lat: number; lng: number }) => haversineM(CENTRO, f) > 12_000;
    expect(sinAlcance.filas.some(lejos)).toBe(true); // sin límite entran los de Carlos Paz
    expect(conAlcance.filas.length).toBeGreaterThan(0);
    expect(conAlcance.filas.some(lejos)).toBe(false);
  });

  it('si ningún cargador es alcanzable lo informa con el detalle de los descartados', async () => {
    const res = await buscar({
      vehiculo: modelo('volvo-ex30'),
      bateriaPct: 5,
      modo: 'ruta',
      origen: CENTRO,
      destino: CARLOS_PAZ,
    });
    expect(res.status).toBe(200);
    expect(res.body.recomendaciones).toEqual([]);
    expect(res.body.sinResultados.codigo).toBe('FUERA_DE_AUTONOMIA');
    expect(res.body.descartados.length).toBeGreaterThan(0);
    expect(res.body.descartados[0].detalle).toMatch(/se llega a 0 km como máximo/);
  });

  it('viaje largo Córdoba → Buenos Aires: plan con paradas sobre la RN 9, cada tramo dentro del alcance (D-045)', async () => {
    const res = await buscar({
      vehiculo: modelo('volvo-ex30'),
      bateriaPct: 80,
      modo: 'ruta',
      origen: CENTRO,
      destino: BUENOS_AIRES,
    });
    expect(res.status).toBe(200);
    const r = res.body;
    expect(r.viaje.llegaSinCargar).toBe(false);
    expect(r.meta.cargadoresDelViaje).toBeGreaterThan(10);
    expect(r.recomendaciones.length).toBeGreaterThan(0);
    for (const rec of r.recomendaciones) {
      const plan = rec.plan;
      expect(plan.factible).toBe(true);
      expect(plan.paradas.length).toBeGreaterThanOrEqual(2);
      expect(plan.paradas[0].cargador.id).toBe(rec.cargador.id);
      for (const parada of plan.paradas.slice(1)) {
        expect(parada.tramoKm).toBeLessThanOrEqual(r.viaje.alcanceConCargaCompletaKm);
        expect(parada.socLlegadaPct).toBeGreaterThanOrEqual(5);
      }
      expect(plan.llegada.socPct).toBeGreaterThanOrEqual(5);
      // Las paradas avanzan hacia el destino
      const kms = plan.paradas.map((x: { kmEnRuta: number }) => x.kmEnRuta);
      expect([...kms].sort((a, b) => a - b)).toEqual(kms);
    }
  });

  it('viaje sin cargadores en el medio (Córdoba → Mendoza): avisa que no es posible y dónde se corta', async () => {
    const res = await buscar({
      vehiculo: modelo('byd-seal'),
      bateriaPct: 100,
      modo: 'ruta',
      origen: CENTRO,
      destino: MENDOZA,
    });
    expect(res.status).toBe(200);
    expect(res.body.recomendaciones).toEqual([]);
    expect(res.body.sinResultados.codigo).toBe('VIAJE_NO_POSIBLE');
    expect(res.body.sinResultados.mensaje).toMatch(
      /No es posible completar este viaje.*lo máximo que recorre el vehículo con la batería llena/,
    );
  });

  it('con el proveedor offline no hay trazado (la interfaz dibuja una recta)', async () => {
    const res = await buscar({
      vehiculo: modelo('peugeot-e208'),
      bateriaPct: 50,
      modo: 'ruta',
      origen: CENTRO,
      destino: CARLOS_PAZ,
    });
    expect(res.body.trazado).toBeNull();
  });

  it('si el proveedor calcula el trazado, la respuesta incluye los puntos del camino', async () => {
    class ConTrazado extends OfflineProvider {
      override async trazado() {
        return {
          puntos: [CENTRO, { lat: -31.43123456, lng: -64.3 }, CARLOS_PAZ],
          distanciaM: 36_540,
          duracionS: 2_430,
          fuente: 'google' as const,
        };
      }
    }
    const app = appDePrueba({ db: ctx.db, rutas: new ConTrazado() });
    const res = await cliente(app).post('/recomendaciones', {
      vehiculo: modelo('peugeot-e208'),
      bateriaPct: 50,
      modo: 'ruta',
      origen: CENTRO,
      destino: CARLOS_PAZ,
    });
    expect(res.body.trazado).toEqual({
      puntos: [
        [CENTRO.lat, CENTRO.lng],
        [-31.43123, -64.3],
        [CARLOS_PAZ.lat, CARLOS_PAZ.lng],
      ],
      distanciaKm: 36.5,
      duracionMin: 41,
      fuente: 'google',
    });

    // En modo ubicación no se pide trazado
    const ubicacion = await cliente(app).post('/recomendaciones', {
      vehiculo: modelo('peugeot-e208'),
      bateriaPct: 50,
      modo: 'ubicacion',
      origen: CENTRO,
    });
    expect(ubicacion.body.trazado).toBeNull();
  });

  it('valida el destino', async () => {
    const sinDestino = await buscar({
      vehiculo: modelo('peugeot-e208'),
      bateriaPct: 50,
      modo: 'ruta',
      origen: CENTRO,
    });
    expect(sinDestino.status).toBe(400);
    const mismoPunto = await buscar({
      vehiculo: modelo('peugeot-e208'),
      bateriaPct: 50,
      modo: 'ruta',
      origen: CENTRO,
      destino: CENTRO,
    });
    expect(mismoPunto.status).toBe(400);
  });
});

describe('validación de la entrada', () => {
  it.each([
    [
      'batería fuera de rango',
      { vehiculo: modelo('peugeot-e208'), bateriaPct: 150, modo: 'ubicacion', origen: CENTRO },
    ],
    ['sin origen', { vehiculo: modelo('peugeot-e208'), bateriaPct: 50, modo: 'ubicacion' }],
    [
      'latitud inválida',
      {
        vehiculo: modelo('peugeot-e208'),
        bateriaPct: 50,
        modo: 'ubicacion',
        origen: { lat: 120, lng: 0 },
      },
    ],
    [
      'vehículo ambiguo',
      {
        vehiculo: { ...modelo('peugeot-e208'), vehiculoUsuarioId: 'x' },
        bateriaPct: 50,
        modo: 'ubicacion',
        origen: CENTRO,
      },
    ],
  ])('%s → 400 VALIDACION', async (_caso, body) => {
    const res = await buscar(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDACION');
  });

  it('modelo inexistente → 404', async () => {
    const res = await buscar({
      vehiculo: { modeloId: crypto.randomUUID() },
      bateriaPct: 50,
      modo: 'ubicacion',
      origen: CENTRO,
    });
    expect(res.status).toBe(404);
  });
});
