// Registro, login local y GET /yo de punta a punta (app completa + base real).
import { randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CognitoAuthProvider } from '../../src/auth/index.js';
import { prepararBaseDePrueba } from '../db/baseDePrueba.js';
import { appDePrueba, configDePrueba } from '../helpers.js';

let db: Knex;
let app: ReturnType<typeof appDePrueba>;

beforeAll(async () => {
  db = await prepararBaseDePrueba();
  app = appDePrueba({ db });
});
afterAll(async () => {
  await db?.destroy();
});

const emailNuevo = () => `${randomUUID()}@test.local`;
const PASSWORD = 'Clave123!';

const registrar = (email: string, password = PASSWORD, nombre = 'Persona Nueva') =>
  request(app).post('/api/v1/auth/local/registro').send({ nombre, email, password });
const login = (email: string, password = PASSWORD) =>
  request(app).post('/api/v1/auth/local/login').send({ email, password });
const yo = (token?: string) => {
  const r = request(app).get('/api/v1/yo');
  return token ? r.set('Authorization', `Bearer ${token}`) : r;
};

describe('POST /auth/local/registro', () => {
  it('crea la cuenta (rol user) y devuelve un token utilizable', async () => {
    const email = emailNuevo();
    const res = await registrar(email);
    expect(res.status).toBe(201);
    expect(res.body.usuario).toMatchObject({ email, nombre: 'Persona Nueva', rol: 'user' });
    expect(typeof res.body.token).toBe('string');

    const perfil = await yo(res.body.token);
    expect(perfil.status).toBe(200);
    expect(perfil.body).toMatchObject({
      id: res.body.usuario.id,
      email,
      rol: 'user',
      modoAuth: 'local',
    });
  });

  it('normaliza el correo y no permite repetirlo (409 EMAIL_EN_USO)', async () => {
    const email = emailNuevo();
    expect((await registrar(email)).status).toBe(201);
    const repetido = await registrar(email.toUpperCase());
    expect(repetido.status).toBe(409);
    expect(repetido.body.error.code).toBe('EMAIL_EN_USO');
  });

  it('valida la política de contraseñas y el formato del correo (400 VALIDACION)', async () => {
    const debil = await registrar(emailNuevo(), 'clave123');
    expect(debil.status).toBe(400);
    expect(debil.body.error.code).toBe('VALIDACION');
    const campos = debil.body.error.details.problemas.map((p: { campo: string }) => p.campo);
    expect(campos).toContain('password');

    const malCorreo = await registrar('no-es-un-correo');
    expect(malCorreo.status).toBe(400);
    expect(malCorreo.body.error.details.problemas[0].campo).toBe('email');
  });

  it('no guarda la contraseña en texto plano', async () => {
    const email = emailNuevo();
    const res = await registrar(email);
    const cred = await db('dev_credencial').where('usuario_id', res.body.usuario.id).first();
    expect(cred.password_hash).not.toContain(PASSWORD);
    expect(cred.password_hash).toMatch(/^\$2[aby]\$10\$/);
  });
});

describe('POST /auth/local/login', () => {
  it('inicia sesión con credenciales válidas', async () => {
    const email = emailNuevo();
    await registrar(email);
    const res = await login(email);
    expect(res.status).toBe(200);
    expect((await yo(res.body.token)).status).toBe(200);
  });

  it('mismo error para contraseña incorrecta y correo inexistente', async () => {
    const email = emailNuevo();
    await registrar(email);
    const malaClave = await login(email, 'Otra123!');
    const noExiste = await login(emailNuevo());
    for (const res of [malaClave, noExiste]) {
      expect(res.status).toBe(401);
      expect(res.body.error).toEqual({
        code: 'CREDENCIALES_INVALIDAS',
        message: 'El correo o la contraseña no son correctos.',
        details: {},
      });
    }
  });

  it('el rol del token sale de dev_credencial (admin)', async () => {
    const email = emailNuevo();
    const reg = await registrar(email);
    await db('dev_credencial').where('usuario_id', reg.body.usuario.id).update({ rol: 'admin' });
    const res = await login(email);
    expect(res.body.usuario.rol).toBe('admin');
    expect((await yo(res.body.token)).body.rol).toBe('admin');
  });

  it('un usuario deshabilitado no puede iniciar sesión (403)', async () => {
    const email = emailNuevo();
    const reg = await registrar(email);
    await db('usuario').where('id', reg.body.usuario.id).update({ activo: false });
    const res = await login(email);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('USUARIO_INACTIVO');
    expect((await yo(reg.body.token)).status).toBe(403);
  });

  it('limita los intentos por IP (429 DEMASIADOS_INTENTOS)', async () => {
    const appAislada = appDePrueba({ db }); // contador propio
    let ultima;
    for (let i = 0; i < 21; i++) {
      ultima = await request(appAislada)
        .post('/api/v1/auth/local/login')
        .send({ email: 'x@test.local', password: 'x' });
    }
    expect(ultima!.status).toBe(429);
    expect(ultima!.body.error.code).toBe('DEMASIADOS_INTENTOS');
  });
});

describe('GET /yo', () => {
  it('sin token → 401', async () => {
    expect((await yo()).status).toBe(401);
  });
});

describe('modo Cognito (verificador simulado)', () => {
  // Cada test registra sus propios tokens → payload, así no dependen del orden de ejecución.
  const tokens = new Map<string, Record<string, unknown>>();
  let appCognito: ReturnType<typeof appDePrueba>;

  /** Registra un token simulado para una identidad nueva y lo devuelve junto con su sub. */
  const tokenCognito = (extra: Record<string, unknown> = {}, sub: string = randomUUID()) => {
    const token = `token-${randomUUID()}`;
    tokens.set(token, {
      sub,
      email: `${sub}@cognito.test`,
      name: 'Usuario Cognito',
      'cognito:groups': ['admin'],
      token_use: 'id',
      ...extra,
    });
    return { token, sub };
  };

  beforeAll(() => {
    const config = configDePrueba({
      AUTH_MODE: 'cognito',
      COGNITO_REGION: 'us-east-1',
      COGNITO_USER_POOL_ID: 'us-east-1_EjemploXX',
      COGNITO_CLIENT_ID: 'cliente',
    });
    const auth = new CognitoAuthProvider({
      verify: async (token) => {
        const payload = tokens.get(token);
        if (!payload) throw new Error('firma inválida');
        return payload;
      },
    });
    appCognito = appDePrueba({ config, db, auth });
  });

  const yoCognito = (token: string) =>
    request(appCognito).get('/api/v1/yo').set('Authorization', `Bearer ${token}`);

  it('las rutas de registro/login local no existen', async () => {
    const res = await request(appCognito).post('/api/v1/auth/local/login').send({});
    expect(res.status).toBe(404);
  });

  it('crea el usuario en el primer /yo con rol del grupo de Cognito', async () => {
    const { token, sub } = tokenCognito();
    const res = await yoCognito(token);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      email: `${sub}@cognito.test`,
      nombre: 'Usuario Cognito',
      rol: 'admin',
      modoAuth: 'cognito',
    });
    expect(await db('usuario').where('cognito_sub', sub)).toHaveLength(1);
  });

  it('sin grupo es user; si cambia el correo en Cognito, se actualiza', async () => {
    const { token, sub } = tokenCognito();
    expect((await yoCognito(token)).status).toBe(200);

    const nuevo = tokenCognito(
      { 'cognito:groups': undefined, email: `${sub}-nuevo@cognito.test` },
      sub,
    );
    const res = await yoCognito(nuevo.token);
    expect(res.body.rol).toBe('user');
    expect(res.body.email).toBe(`${sub}-nuevo@cognito.test`);
    expect(await db('usuario').where('cognito_sub', sub)).toHaveLength(1);
  });

  it('token rechazado por el verificador → 401', async () => {
    const res = await yoCognito('token-falso');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALIDO');
  });
});
