// POST /recomendaciones de punta a punta con el seed (preselección espacial + proveedor offline + motor).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { uuidDeterministico } from '../../seeds/aleatorio.js';
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
