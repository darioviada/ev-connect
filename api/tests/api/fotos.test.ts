// Fotos del catálogo (D-047): las del seed (Wikimedia Commons), la descarga pública y la carga del admin.
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { uuidDeterministico } from '../../seeds/aleatorio.js';
import { sembrar } from '../../seeds/demo.js';
import { coincideFirma } from '../../src/modules/vehiculos/vehiculos.routes.js';
import { HOY_API } from '../helpers.js';
import { cliente, prepararContextoApi, tokenSeed, type ContextoApi } from './contexto.js';

let ctx: ContextoApi;
beforeAll(async () => {
  ctx = await prepararContextoApi();
});
afterAll(async () => {
  await ctx?.db.destroy();
});

const admin = () => cliente(ctx.app, tokenSeed('admin'));
const invitado = () => cliente(ctx.app);
const EX30 = uuidDeterministico('modelo:volvo-ex30');
const FICTICIO = uuidDeterministico('modelo:ficticio-urbano-t2');
/** PNG mínimo: firma + algunos bytes (alcanza para la validación de la firma). */
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32, 1),
]);

const subir = (id: string, cuerpo: Buffer, tipo: string, query = '', token = tokenSeed('admin')) =>
  request(ctx.app)
    .put(`/api/v1/admin/vehiculos-modelo/${id}/foto${query}`)
    .set('Authorization', `Bearer ${token}`)
    .set('Content-Type', tipo)
    .send(cuerpo);

describe('fotos del catálogo', () => {
  it('el seed carga una foto con crédito para cada modelo real; el ficticio no tiene', async () => {
    const r = await invitado().get('/vehiculos-modelo?limit=100');
    const porId = new Map(r.body.items.map((m: { id: string }) => [m.id, m]));
    const ex30 = porId.get(EX30) as Record<string, string>;
    expect(ex30.fotoUrl).toMatch(new RegExp(`^/api/v1/vehiculos-modelo/${EX30}/foto\\?v=\\d+$`));
    expect(ex30.fotoCredito).toMatch(/CC BY-SA 4\.0 · Wikimedia Commons/);
    expect(ex30.fotoFuenteUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    expect(porId.get(FICTICIO)).toMatchObject({ fotoUrl: null, fotoCredito: null });
    const conFoto = r.body.items.filter((m: { fotoUrl: string | null }) => m.fotoUrl);
    expect(conFoto).toHaveLength(7);
  });

  it('la foto se descarga sin sesión, con su tipo y caché', async () => {
    const r = await request(ctx.app).get(`/api/v1/vehiculos-modelo/${EX30}/foto`);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toBe('image/jpeg');
    expect(r.headers['cache-control']).toContain('max-age');
    expect(coincideFirma(r.body as Buffer, 'image/jpeg')).toBe(true);
    const sin = await invitado().get(`/vehiculos-modelo/${FICTICIO}/foto`);
    expect(sin.status).toBe(404);
    expect(sin.body.error.code).toBe('SIN_FOTO');
  });

  it('el admin la reemplaza (con crédito) y la elimina', async () => {
    const credito = encodeURIComponent('Foto: Prueba · CC0');
    const r = await subir(FICTICIO, PNG, 'image/png', `?credito=${credito}`);
    expect(r.status).toBe(200);
    expect(r.body.fotoUrl).toMatch(/\/foto\?v=\d+$/);
    expect(r.body.fotoCredito).toBe('Foto: Prueba · CC0');
    const descarga = await request(ctx.app).get(`/api/v1/vehiculos-modelo/${FICTICIO}/foto`);
    expect(descarga.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(descarga.body as Buffer, PNG)).toBe(0);

    expect((await admin().delete(`/admin/vehiculos-modelo/${FICTICIO}/foto`)).status).toBe(204);
    expect((await invitado().get(`/vehiculos-modelo/${FICTICIO}/foto`)).status).toBe(404);
  });

  it('rechaza lo que no es una imagen, aunque declare serlo, y archivos de más de 2 MB', async () => {
    const texto = await subir(EX30, Buffer.from('<script>alert(1)</script>'), 'image/png');
    expect(texto.status).toBe(400);
    expect(texto.body.error.code).toBe('FOTO_INVALIDA');
    const gif = await subir(EX30, Buffer.from('GIF89a......'), 'image/gif');
    expect(gif.status).toBe(400);
    const grande = await subir(
      EX30,
      Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]),
      'image/png',
    );
    expect(grande.status).toBe(413);
    const urlMala = await subir(EX30, PNG, 'image/png', '?fuenteUrl=javascript:alert(1)');
    expect(urlMala.status).toBe(400);
  });

  it('solo el admin puede subirla', async () => {
    const r = await subir(EX30, PNG, 'image/png', '', tokenSeed('usuario'));
    expect(r.status).toBe(403);
    const sinSesion = await request(ctx.app)
      .put(`/api/v1/admin/vehiculos-modelo/${EX30}/foto`)
      .set('Content-Type', 'image/png')
      .send(PNG);
    expect(sinSesion.status).toBe(401);
  });

  it('los vehículos guardados del catálogo muestran la foto del modelo', async () => {
    const usuario = cliente(ctx.app, tokenSeed('usuario'));
    const creado = await usuario.post('/mis-vehiculos', { modeloId: EX30 });
    expect(creado.status).toBe(201);
    expect(creado.body.fotoUrl).toMatch(new RegExp(`/vehiculos-modelo/${EX30}/foto`));
    const lista = await usuario.get('/mis-vehiculos');
    const mio = lista.body.items.find((v: { id: string }) => v.id === creado.body.id);
    expect(mio.fotoUrl).toBe(creado.body.fotoUrl);
    await usuario.delete(`/mis-vehiculos/${creado.body.id}`);
  });

  it('volver a sembrar no pisa una foto subida por el admin', async () => {
    await subir(EX30, PNG, 'image/png', `?credito=${encodeURIComponent('Foto del admin')}`);
    await sembrar(ctx.db, { reset: false, modoAuth: 'local', hoy: HOY_API });
    const fila = await ctx.db('vehiculo_foto').where('modelo_id', EX30).first();
    expect(fila.credito).toBe('Foto del admin');
    expect(fila.tipo_mime).toBe('image/png');
  });
});
