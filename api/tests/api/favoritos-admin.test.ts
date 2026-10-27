// Favoritos y rutas guardadas (HU-011), geocodificación y administración de usuarios (P2).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GeocodificacionNoDisponibleError } from '../../src/routing/geocodificacion/index.js';
import { appDePrueba } from '../helpers.js';
import {
  cliente,
  idUsuarioSeed,
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

describe('favoritos', () => {
  it('agregar (idempotente), listar y quitar', async () => {
    const c = ctx.datos.cargadores.find((x) => x.tipo === 'publico' && x.zona.clave === 'jardin')!;
    expect((await usuario().post('/favoritos', { cargadorId: c.id })).status).toBe(201);
    expect((await usuario().post('/favoritos', { cargadorId: c.id })).status).toBe(200);
    const lista = await usuario().get('/favoritos');
    expect(lista.body.items.map((x: { id: string }) => x.id)).toContain(c.id);
    expect((await usuario().delete(`/favoritos/${c.id}`)).status).toBe(204);
    expect(
      (await usuario().get('/favoritos')).body.items.map((x: { id: string }) => x.id),
    ).not.toContain(c.id);
  });

  it('cargador inexistente → 404', async () => {
    expect((await usuario().post('/favoritos', { cargadorId: crypto.randomUUID() })).status).toBe(
      404,
    );
  });
});

describe('rutas guardadas', () => {
  it('crear, listar y borrar; nadie borra rutas ajenas', async () => {
    const res = await usuario().post('/rutas-guardadas', {
      nombre: 'Casa → Alta Gracia',
      origen: { lat: -31.42, lng: -64.19 },
      destino: { lat: -31.654, lng: -64.4284 },
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ nombre: 'Casa → Alta Gracia', destino: { lat: -31.654 } });
    expect((await usuario().get('/rutas-guardadas')).body.items.length).toBeGreaterThanOrEqual(2);
    expect((await admin().delete(`/rutas-guardadas/${res.body.id}`)).status).toBe(404);
    expect((await usuario().delete(`/rutas-guardadas/${res.body.id}`)).status).toBe(204);
  });

  it('valida nombre y coordenadas', async () => {
    const res = await usuario().post('/rutas-guardadas', {
      nombre: '',
      origen: { lat: 0, lng: 0 },
      destino: { lat: 99, lng: 0 },
    });
    expect(res.status).toBe(400);
  });
});

describe('geocodificación', () => {
  it('lista fija: encuentra barrios y ciudades', async () => {
    const res = await cliente(ctx.app).get('/geocodificar?q=nueva%20cordoba');
    expect(res.status).toBe(200);
    expect(res.body.proveedor).toBe('static');
    expect(res.body.resultados[0]).toMatchObject({
      nombre: 'Nueva Córdoba',
      lat: expect.any(Number),
    });
  });

  it('consulta demasiado corta → 400', async () => {
    expect((await cliente(ctx.app).get('/geocodificar?q=a')).status).toBe(400);
  });

  it('si el proveedor externo falla → 503 con mensaje para el usuario', async () => {
    const app = appDePrueba({
      db: ctx.db,
      geocoding: {
        nombre: 'nominatim',
        buscar: async () => {
          throw new GeocodificacionNoDisponibleError('caído');
        },
      },
    });
    const res = await cliente(app).get('/geocodificar?q=centro');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('GEOCODIFICACION_NO_DISPONIBLE');
  });
});

describe('administración de usuarios (P2)', () => {
  it('lista usuarios con rol (modo local) y búsqueda', async () => {
    const res = await admin().get('/admin/usuarios?q=demo.local&limit=100');
    expect(res.status).toBe(200);
    const demo = res.body.items.find((u: { email: string }) => u.email === 'usuario@demo.local');
    expect(demo).toMatchObject({ rol: 'user', activo: true });
  });

  it('deshabilitar a un usuario le corta el acceso (403) y habilitarlo lo restituye', async () => {
    const id = idUsuarioSeed('anfitrion-10');
    const anfitrion = cliente(ctx.app, tokenSeed('anfitrion-10'));
    expect((await anfitrion.get('/yo')).status).toBe(200);

    expect((await admin().patch(`/admin/usuarios/${id}`, { activo: false })).body.activo).toBe(
      false,
    );
    expect((await anfitrion.get('/yo')).status).toBe(403);

    await admin().patch(`/admin/usuarios/${id}`, { activo: true });
    expect((await anfitrion.get('/yo')).status).toBe(200);
  });

  it('cambia el rol en modo local; sin credencial local → 409', async () => {
    const reg = await cliente(ctx.app).post('/auth/local/registro', {
      nombre: 'Para promover',
      email: `${crypto.randomUUID()}@test.local`,
      password: 'Clave123!',
    });
    const res = await admin().patch(`/admin/usuarios/${reg.body.usuario.id}`, { rol: 'admin' });
    expect(res.body.rol).toBe('admin');

    const sinCredencial = await admin().patch(`/admin/usuarios/${idUsuarioSeed('anfitrion-11')}`, {
      rol: 'admin',
    });
    expect(sinCredencial.status).toBe(409);
  });

  it('un admin no puede deshabilitarse a sí mismo', async () => {
    const res = await admin().patch(`/admin/usuarios/${idUsuarioSeed('admin')}`, { activo: false });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('AUTOGESTION_NO_PERMITIDA');
  });

  it('cuerpo vacío o campos desconocidos → 400; usuario inexistente → 404', async () => {
    expect((await admin().patch(`/admin/usuarios/${idUsuarioSeed('usuario')}`, {})).status).toBe(
      400,
    );
    expect(
      (await admin().patch(`/admin/usuarios/${idUsuarioSeed('usuario')}`, { email: 'x' })).status,
    ).toBe(400);
    expect(
      (await admin().patch(`/admin/usuarios/${crypto.randomUUID()}`, { activo: true })).status,
    ).toBe(404);
  });
});
