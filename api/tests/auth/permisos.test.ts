// Middlewares de autorización contra la base real: invitado / user / admin / dueño / deshabilitado.
// Usa rutas de prueba; la matriz completa de SPEC §2 sobre los endpoints reales se completa en la Fase 4.
import express from 'express';
import type { Knex } from 'knex';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { autenticar, esDuenoOAdmin, requerirRol } from '../../src/middleware/auth.js';
import { manejadorErrores } from '../../src/middleware/errores.js';
import { crearLogger } from '../../src/logger.js';
import { prepararBaseDePrueba } from '../db/baseDePrueba.js';
import { authLocalDePrueba, configDePrueba, tokenDePrueba } from '../helpers.js';

let db: Knex;
let app: express.Express;

beforeAll(async () => {
  db = await prepararBaseDePrueba();
  const deps = { db, auth: authLocalDePrueba() };
  const opcional = autenticar(deps, { obligatorio: false });
  const obligatorio = autenticar(deps, { obligatorio: true });

  app = express();
  app.get('/abierto', opcional, (req, res) => {
    res.json({ usuario: req.usuario ?? null });
  });
  app.get('/protegido', obligatorio, (req, res) => {
    res.json({ usuario: req.usuario });
  });
  app.get('/admin', obligatorio, requerirRol('admin'), (_req, res) => {
    res.json({ ok: true });
  });
  // El dueño del "recurso" viaja en la URL: 'publico' = sin dueño, 'nadie' = no existe.
  app.get(
    '/recursos/:dueno',
    obligatorio,
    esDuenoOAdmin(async (req) => {
      const dueno = String(req.params.dueno);
      if (dueno === 'nadie') return undefined;
      if (dueno === 'publico') return null;
      return dueno;
    }),
    (_req, res) => {
      res.json({ ok: true });
    },
  );
  app.use(manejadorErrores(crearLogger(configDePrueba())));
});

afterAll(async () => {
  await db?.destroy();
});

const conToken = (ruta: string, token?: string) => {
  const r = request(app).get(ruta);
  return token ? r.set('Authorization', `Bearer ${token}`) : r;
};

/** Crea el usuario (primer uso del token) y devuelve su id. */
async function idDe(token: string): Promise<string> {
  const res = await conToken('/protegido', token);
  return res.body.usuario.id;
}

describe('autenticar', () => {
  it('ruta abierta: el invitado pasa sin usuario', async () => {
    const res = await conToken('/abierto');
    expect(res.status).toBe(200);
    expect(res.body.usuario).toBeNull();
  });

  it('ruta abierta: con token válido identifica al usuario', async () => {
    const res = await conToken('/abierto', tokenDePrueba('user'));
    expect(res.status).toBe(200);
    expect(res.body.usuario.rol).toBe('user');
  });

  it('ruta protegida: invitado → 401 NO_AUTENTICADO', async () => {
    const res = await conToken('/protegido');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('NO_AUTENTICADO');
  });

  it.each([
    ['token basura', 'Bearer xxx.yyy.zzz'],
    ['esquema distinto de Bearer', `Basic ${tokenDePrueba()}`],
    ['sin token', 'Bearer'],
  ])('%s → 401 TOKEN_INVALIDO (también en rutas abiertas)', async (_caso, encabezado) => {
    for (const ruta of ['/protegido', '/abierto']) {
      const res = await request(app).get(ruta).set('Authorization', encabezado);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TOKEN_INVALIDO');
    }
  });

  it('crea el usuario la primera vez y no lo duplica después', async () => {
    const token = tokenDePrueba('user', { nombre: 'Primera Vez' });
    const id1 = await idDe(token);
    const id2 = await idDe(token);
    expect(id1).toBe(id2);
    const filas = await db('usuario').where('id', id1);
    expect(filas).toHaveLength(1);
    expect(filas[0].nombre).toBe('Primera Vez');
  });

  it('un usuario deshabilitado recibe 403 en toda ruta autenticada', async () => {
    const token = tokenDePrueba('admin');
    const id = await idDe(token);
    await db('usuario').where('id', id).update({ activo: false });
    for (const ruta of ['/abierto', '/protegido', '/admin', `/recursos/${id}`]) {
      const res = await conToken(ruta, token);
      expect(res.status, ruta).toBe(403);
      expect(res.body.error.code).toBe('USUARIO_INACTIVO');
    }
  });
});

describe('requerirRol', () => {
  it('invitado 401 · user 403 · admin 200', async () => {
    expect((await conToken('/admin')).status).toBe(401);
    const user = await conToken('/admin', tokenDePrueba('user'));
    expect(user.status).toBe(403);
    expect(user.body.error.code).toBe('PERMISO_DENEGADO');
    expect((await conToken('/admin', tokenDePrueba('admin'))).status).toBe(200);
  });
});

describe('esDuenoOAdmin', () => {
  it('el dueño accede; otro usuario no; el admin sí', async () => {
    const tokenDueno = tokenDePrueba('user');
    const duenoId = await idDe(tokenDueno);

    expect((await conToken(`/recursos/${duenoId}`, tokenDueno)).status).toBe(200);

    const ajeno = await conToken(`/recursos/${duenoId}`, tokenDePrueba('user'));
    expect(ajeno.status).toBe(403);
    expect(ajeno.body.error.code).toBe('PERMISO_DENEGADO');

    expect((await conToken(`/recursos/${duenoId}`, tokenDePrueba('admin'))).status).toBe(200);
  });

  it('un recurso sin dueño (público) solo lo administra un admin', async () => {
    expect((await conToken('/recursos/publico', tokenDePrueba('user'))).status).toBe(403);
    expect((await conToken('/recursos/publico', tokenDePrueba('admin'))).status).toBe(200);
  });

  it('un recurso inexistente → 404', async () => {
    const res = await conToken('/recursos/nadie', tokenDePrueba('user'));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NO_ENCONTRADO');
  });

  it('invitado → 401', async () => {
    expect((await conToken('/recursos/publico')).status).toBe(401);
  });
});
