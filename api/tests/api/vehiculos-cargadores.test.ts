// Catálogo, vehículos propios (HU-002/003) y cargadores (HU-004/005), incluida la moderación del admin.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { uuidDeterministico } from '../../seeds/aleatorio.js';
import {
  claveDueno,
  cliente,
  prepararContextoApi,
  tokenSeed,
  type ContextoApi,
} from './contexto.js';

let ctx: ContextoApi;
beforeAll(async () => {
  ctx = await prepararContextoApi();
});
afterAll(async () => {
  await ctx?.db.destroy();
});

const usuario = () => cliente(ctx.app, tokenSeed('usuario'));
const admin = () => cliente(ctx.app, tokenSeed('admin'));
const invitado = () => cliente(ctx.app);

const PERSONALIZADO = {
  marca: 'Casero',
  modelo: `Prototipo ${Math.random()}`,
  capacidadBateriaKwh: 40,
  consumoKwhPor100km: 15,
  tipoConector: 'CCS_COMBO',
  potenciaMaxAcKw: 7.4,
  potenciaMaxDcKw: 50,
};

describe('catálogo', () => {
  it('es público, paginado y con búsqueda (sin interpretar comodines)', async () => {
    const todo = await invitado().get('/vehiculos-modelo?limit=100');
    expect(todo.status).toBe(200);
    expect(todo.body.paginacion.total).toBe(8);
    expect(todo.body.items[0]).toEqual(
      expect.objectContaining({
        marca: expect.any(String),
        capacidadBateriaKwh: expect.any(Number),
        potenciaMaxDcKw: expect.anything(),
      }),
    );
    const byd = await invitado().get('/vehiculos-modelo?q=byd');
    expect(byd.body.items.map((m: { marca: string }) => m.marca)).toEqual(['BYD', 'BYD', 'BYD']);
    expect((await invitado().get('/vehiculos-modelo?q=%25')).body.items).toEqual([]);
    const pagina = await invitado().get('/vehiculos-modelo?limit=3&offset=3');
    expect(pagina.body.items).toHaveLength(3);
  });

  it('el admin administra el catálogo; duplicados y modelos en uso → 409', async () => {
    const creado = await admin().post('/admin/vehiculos-modelo', PERSONALIZADO);
    expect(creado.status).toBe(201);
    expect((await admin().post('/admin/vehiculos-modelo', PERSONALIZADO)).status).toBe(409);

    const editado = await admin().put(`/admin/vehiculos-modelo/${creado.body.id}`, {
      ...PERSONALIZADO,
      consumoKwhPor100km: 16,
    });
    expect(editado.body.consumoKwhPor100km).toBe(16);

    // e-208 lo tiene guardado usuario@demo → no se puede borrar
    const enUso = await admin().delete(
      `/admin/vehiculos-modelo/${uuidDeterministico('modelo:peugeot-e208')}`,
    );
    expect(enUso.status).toBe(409);
    expect(enUso.body.error.code).toBe('MODELO_EN_USO');

    expect((await admin().delete(`/admin/vehiculos-modelo/${creado.body.id}`)).status).toBe(204);
    expect((await usuario().post('/admin/vehiculos-modelo', PERSONALIZADO)).status).toBe(403);
  });

  it('valida que un vehículo CCS o CHAdeMO indique su potencia DC', async () => {
    const res = await admin().post('/admin/vehiculos-modelo', {
      ...PERSONALIZADO,
      potenciaMaxDcKw: null,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details.problemas[0].campo).toBe('potenciaMaxDcKw');
  });
});

describe('mis vehículos', () => {
  it('lista el vehículo guardado del seed', async () => {
    const res = await usuario().get('/mis-vehiculos');
    expect(res.body.items).toEqual([
      expect.objectContaining({ marca: 'Peugeot', modelo: 'e-208', personalizado: false }),
    ]);
  });

  it('alta desde el catálogo y personalizada, edición y baja; no altera el catálogo', async () => {
    const cliente = cliente2();
    const delCatalogo = await cliente.post('/mis-vehiculos', {
      modeloId: uuidDeterministico('modelo:byd-seal'),
    });
    expect(delCatalogo.status).toBe(201);
    expect(delCatalogo.body).toMatchObject({ marca: 'BYD', modelo: 'Seal', personalizado: false });

    const propio = await cliente.post('/mis-vehiculos', { personalizado: PERSONALIZADO });
    expect(propio.status).toBe(201);
    expect(propio.body).toMatchObject({ marca: 'Casero', personalizado: true, modeloId: null });

    const editado = await cliente.put(`/mis-vehiculos/${propio.body.id}`, {
      personalizado: { ...PERSONALIZADO, capacidadBateriaKwh: 45 },
    });
    expect(editado.body.capacidadBateriaKwh).toBe(45);

    expect((await cliente.get('/mis-vehiculos')).body.items).toHaveLength(2);
    expect((await cliente.delete(`/mis-vehiculos/${delCatalogo.body.id}`)).status).toBe(204);
    expect((await invitado().get('/vehiculos-modelo')).body.paginacion.total).toBe(8);
  });

  it('nadie edita ni borra vehículos ajenos (404)', async () => {
    const ajeno = uuidDeterministico('vehiculo:usuario:1');
    expect(
      (
        await admin().put(`/mis-vehiculos/${ajeno}`, {
          modeloId: uuidDeterministico('modelo:byd-seal'),
        })
      ).status,
    ).toBe(404);
    expect((await admin().delete(`/mis-vehiculos/${ajeno}`)).status).toBe(404);
  });

  it('modelo inexistente → 404; id mal formado → 400', async () => {
    expect((await usuario().post('/mis-vehiculos', { modeloId: crypto.randomUUID() })).status).toBe(
      404,
    );
    expect((await usuario().delete('/mis-vehiculos/no-es-un-id')).status).toBe(400);
  });
});

function cliente2() {
  return cliente(ctx.app, tokenSeed('anfitrion-25'));
}

describe('cargadores: consulta de la red', () => {
  it('lista públicos y privados activos juntos; los inactivos no aparecen', async () => {
    const res = await invitado().get('/cargadores');
    expect(res.status).toBe(200);
    // Otros tests de este archivo publican o desactivan cargadores: se compara contra la base.
    const activos = await ctx.db('cargador').where('estado', 'activo').pluck('id');
    const ids = res.body.items.map((c: { id: string }) => c.id);
    expect(ids.sort()).toEqual(activos.sort());
    const inactivosDelSeed = ctx.datos.cargadores
      .filter((c) => c.estado === 'inactivo')
      .map((c) => c.id);
    expect(ids.some((id: string) => inactivosDelSeed.includes(id))).toBe(false);
    const tipos = new Set(res.body.items.map((c: { tipo: string }) => c.tipo));
    expect(tipos).toEqual(new Set(['publico', 'privado']));
  });

  it('filtra por bbox (Córdoba capital)', async () => {
    const res = await invitado().get('/cargadores?bbox=-64.3,-31.5,-64.1,-31.3');
    expect(res.body.items.length).toBeGreaterThan(30);
    expect(res.body.items.length).toBeLessThan(
      (await invitado().get('/cargadores')).body.items.length,
    );
    expect(
      res.body.items.every((c: { ubicacion: { lng: number } }) => c.ubicacion.lng > -64.3),
    ).toBe(true);
    expect((await invitado().get('/cargadores?bbox=1,2,3')).status).toBe(400);
  });

  it('detalle con disponibilidad y ocupación sin datos personales', async () => {
    const conReservas = await ctx
      .db('reserva')
      .whereNot('estado', 'cancelada')
      .where('fecha', '>=', '2026-10-27')
      .first('cargador_id');
    const res = await invitado().get(`/cargadores/${conReservas.cargador_id}`);
    expect(res.status).toBe(200);
    expect(res.body.disponibilidad).toEqual(expect.any(Array));
    expect(res.body.ocupacion.length).toBeGreaterThan(0);
    expect(Object.keys(res.body.ocupacion[0]).sort()).toEqual([
      'estado',
      'fecha',
      'horaFin',
      'horaInicio',
    ]);
  });

  it('un inactivo no se ve para invitados pero sí para su dueño', async () => {
    const inactivo = ctx.datos.cargadores.find((c) => c.estado === 'inactivo')!;
    expect((await invitado().get(`/cargadores/${inactivo.id}`)).status).toBe(404);
    const dueno = cliente(ctx.app, tokenSeed(claveDueno(ctx.datos, inactivo)));
    expect((await dueno.get(`/cargadores/${inactivo.id}`)).status).toBe(200);
  });
});

describe('cargadores: publicación y gestión (HU-004)', () => {
  const nuevo = {
    nombre: 'Cochera de prueba',
    direccion: 'Calle de ejemplo 123',
    ubicacion: { lat: -31.41, lng: -64.19 },
    tipoConector: 'TIPO_2',
    potenciaKw: 7.4,
    precioKwh: 300,
    disponibilidad: [{ dia: 'sabado', horaInicio: '09:00', horaFin: '21:00' }],
  };

  it('un usuario publica un cargador privado propio con su disponibilidad', async () => {
    const res = await usuario().post('/cargadores', nuevo);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      tipo: 'privado',
      estado: 'activo',
      potenciaKw: 7.4,
      ubicacion: { lat: -31.41, lng: -64.19 },
    });
    expect(res.body.disponibilidad).toEqual(nuevo.disponibilidad);
    const mios = await usuario().get('/mis-cargadores');
    expect(mios.body.items.some((c: { id: string }) => c.id === res.body.id)).toBe(true);
  });

  it('solo un admin publica cargadores públicos', async () => {
    expect((await usuario().post('/cargadores', { ...nuevo, tipo: 'publico' })).status).toBe(403);
    const res = await admin().post('/cargadores', { ...nuevo, tipo: 'publico' });
    expect(res.status).toBe(201);
    expect(res.body.duenoId).toBeNull();
  });

  it.each([
    ['sin nombre', { ...nuevo, nombre: '' }],
    ['potencia negativa', { ...nuevo, potenciaKw: -1 }],
    ['conector inválido', { ...nuevo, tipoConector: 'SCHUKO' }],
    [
      'franjas superpuestas',
      {
        ...nuevo,
        disponibilidad: [
          { dia: 'lunes', horaInicio: '08:00', horaFin: '12:00' },
          { dia: 'lunes', horaInicio: '11:00', horaFin: '14:00' },
        ],
      },
    ],
    [
      'franja invertida',
      { ...nuevo, disponibilidad: [{ dia: 'lunes', horaInicio: '12:00', horaFin: '08:00' }] },
    ],
  ])('%s → 400', async (_caso, body) => {
    const res = await usuario().post('/cargadores', body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDACION');
  });

  it('el dueño edita, desactiva y cambia la disponibilidad; otro usuario no (403); el admin sí', async () => {
    const { body: c } = await usuario().post('/cargadores', nuevo);

    const editado = await usuario().put(`/cargadores/${c.id}`, {
      precioKwh: 350,
      estado: 'inactivo',
    });
    expect(editado.body).toMatchObject({ precioKwh: 350, estado: 'inactivo' });

    const franjas = await usuario().put(`/cargadores/${c.id}/disponibilidad`, { franjas: [] });
    expect(franjas.body.disponibilidad).toEqual([]); // 24/7

    const ajeno = await cliente2().put(`/cargadores/${c.id}`, { precioKwh: 1 });
    expect(ajeno.status).toBe(403);
    expect((await cliente2().delete(`/cargadores/${c.id}`)).status).toBe(403);

    expect((await admin().put(`/cargadores/${c.id}`, { estado: 'activo' })).body.estado).toBe(
      'activo',
    );
    expect((await usuario().put(`/cargadores/${c.id}`, {})).status).toBe(400);
    expect(
      (await usuario().put(`/cargadores/${crypto.randomUUID()}`, { precioKwh: 1 })).status,
    ).toBe(404);
  });

  it('un usuario no puede editar cargadores públicos', async () => {
    const publico = ctx.datos.cargadores.find((c) => c.tipo === 'publico')!;
    expect((await usuario().put(`/cargadores/${publico.id}`, { precioKwh: 1 })).status).toBe(403);
  });

  it('no se elimina un cargador con reservas futuras (409); sin reservas, sí (204)', async () => {
    const conReservas = await ctx
      .db('reserva as r')
      .join('cargador as c', 'c.id', 'r.cargador_id')
      .where('c.tipo', 'privado')
      .whereNot('r.estado', 'cancelada')
      .where('r.fecha', '>=', '2026-10-27')
      .first('c.id', 'c.usuario_id');
    const claveDelDueno = ctx.datos.usuarios.find((u) => u.id === conReservas.usuario_id)!.clave;
    const res = await cliente(ctx.app, tokenSeed(claveDelDueno)).delete(
      `/cargadores/${conReservas.id}`,
    );
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CARGADOR_CON_RESERVAS');

    const { body: c } = await usuario().post('/cargadores', nuevo);
    expect((await usuario().delete(`/cargadores/${c.id}`)).status).toBe(204);
  });

  it('el admin modera cualquier cargador (PATCH /admin/cargadores/:id)', async () => {
    const { body: c } = await usuario().post('/cargadores', nuevo);
    const res = await admin().patch(`/admin/cargadores/${c.id}`, { estado: 'inactivo' });
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('inactivo');
    expect(
      (await invitado().get('/cargadores')).body.items.some((x: { id: string }) => x.id === c.id),
    ).toBe(false);
  });
});
