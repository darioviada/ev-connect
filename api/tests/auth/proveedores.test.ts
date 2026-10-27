// Proveedores de autenticación (unitarios, sin base de datos ni red).
import jwt from 'jsonwebtoken';
import { describe, expect, it, vi } from 'vitest';
import {
  CognitoAuthProvider,
  crearAuthProvider,
  esquemaPassword,
  LocalAuthProvider,
  rolDeGrupos,
  TokenInvalidoError,
} from '../../src/auth/index.js';
import { configDePrueba, SECRETO_DE_PRUEBA } from '../helpers.js';

const local = new LocalAuthProvider(SECRETO_DE_PRUEBA);
const datos = { sub: 'abc-123', email: 'ana@test.local', nombre: 'Ana', rol: 'admin' as const };

describe('rolDeGrupos', () => {
  it('admin si el grupo admin está presente; user en cualquier otro caso', () => {
    expect(rolDeGrupos(['admin'])).toBe('admin');
    expect(rolDeGrupos(['user', 'admin'])).toBe('admin');
    expect(rolDeGrupos(['user'])).toBe('user');
    expect(rolDeGrupos([])).toBe('user');
  });
});

describe('LocalAuthProvider', () => {
  it('firma y verifica con las mismas claims que un ID token de Cognito', async () => {
    const token = local.firmar(datos);
    const claims = jwt.decode(token) as Record<string, unknown>;
    expect(claims).toMatchObject({
      sub: 'abc-123',
      email: 'ana@test.local',
      'cognito:groups': ['admin'],
      token_use: 'id',
    });
    expect(await local.verificar(token)).toEqual({
      sub: 'abc-123',
      email: 'ana@test.local',
      nombre: 'Ana',
      grupos: ['admin'],
    });
  });

  it('rechaza tokens vencidos', async () => {
    const token = local.firmar(datos, -10);
    await expect(local.verificar(token)).rejects.toBeInstanceOf(TokenInvalidoError);
  });

  it('rechaza tokens firmados con otro secreto', async () => {
    const otro = new LocalAuthProvider('y'.repeat(40)).firmar(datos);
    await expect(local.verificar(otro)).rejects.toBeInstanceOf(TokenInvalidoError);
  });

  it('rechaza otro algoritmo aunque use el mismo secreto (solo HS256)', async () => {
    const token = jwt.sign(
      { email: datos.email, 'cognito:groups': [], token_use: 'id' },
      SECRETO_DE_PRUEBA,
      { algorithm: 'HS512', subject: 'x', issuer: 'ev-connect-local', audience: 'ev-connect' },
    );
    await expect(local.verificar(token)).rejects.toBeInstanceOf(TokenInvalidoError);
  });

  it('rechaza tokens sin firma (alg "none")', async () => {
    const token = jwt.sign({ email: datos.email, token_use: 'id' }, '', {
      algorithm: 'none',
      subject: 'x',
      issuer: 'ev-connect-local',
      audience: 'ev-connect',
    });
    await expect(local.verificar(token)).rejects.toBeInstanceOf(TokenInvalidoError);
  });

  it('rechaza tokens con otro emisor o sin email', async () => {
    const otroEmisor = jwt.sign({ email: datos.email, token_use: 'id' }, SECRETO_DE_PRUEBA, {
      subject: 'x',
      issuer: 'otro',
      audience: 'ev-connect',
    });
    await expect(local.verificar(otroEmisor)).rejects.toBeInstanceOf(TokenInvalidoError);

    const sinEmail = jwt.sign({ token_use: 'id' }, SECRETO_DE_PRUEBA, {
      subject: 'x',
      issuer: 'ev-connect-local',
      audience: 'ev-connect',
    });
    await expect(local.verificar(sinEmail)).rejects.toBeInstanceOf(TokenInvalidoError);
  });
});

describe('CognitoAuthProvider (verificador simulado)', () => {
  it('traduce el payload verificado a una identidad', async () => {
    const verify = vi.fn().mockResolvedValue({
      sub: 'sub-cognito',
      email: 'bea@test.local',
      name: 'Bea',
      'cognito:groups': ['admin'],
      token_use: 'id',
    });
    const proveedor = new CognitoAuthProvider({ verify });
    expect(await proveedor.verificar('token')).toEqual({
      sub: 'sub-cognito',
      email: 'bea@test.local',
      nombre: 'Bea',
      grupos: ['admin'],
    });
    expect(verify).toHaveBeenCalledWith('token');
  });

  it('sin grupos, la identidad queda con grupos vacíos (rol user)', async () => {
    const proveedor = new CognitoAuthProvider({
      verify: async () => ({ sub: 's', email: 'c@test.local' }),
    });
    const identidad = await proveedor.verificar('token');
    expect(identidad.grupos).toEqual([]);
    expect(rolDeGrupos(identidad.grupos)).toBe('user');
  });

  it('rechaza si el verificador falla (firma, vencimiento, audiencia, token_use)', async () => {
    const proveedor = new CognitoAuthProvider({
      verify: async () => {
        throw new Error('Token expired');
      },
    });
    await expect(proveedor.verificar('token')).rejects.toBeInstanceOf(TokenInvalidoError);
  });

  it('rechaza un token verificado que no trae email (p. ej. un access token)', async () => {
    const proveedor = new CognitoAuthProvider({ verify: async () => ({ sub: 's' }) });
    await expect(proveedor.verificar('token')).rejects.toBeInstanceOf(TokenInvalidoError);
  });

  it('con el verificador real, un token mal formado se rechaza sin salir a la red', async () => {
    const proveedor = CognitoAuthProvider.desdeConfig({
      userPoolId: 'us-east-1_EjemploXX',
      clientId: 'cliente-de-ejemplo',
    });
    await expect(proveedor.verificar('esto-no-es-un-jwt')).rejects.toBeInstanceOf(
      TokenInvalidoError,
    );
  });
});

describe('crearAuthProvider', () => {
  it('elige el proveedor según AUTH_MODE', () => {
    expect(crearAuthProvider(configDePrueba()).modo).toBe('local');
    const cognito = configDePrueba({
      AUTH_MODE: 'cognito',
      COGNITO_REGION: 'us-east-1',
      COGNITO_USER_POOL_ID: 'us-east-1_EjemploXX',
      COGNITO_CLIENT_ID: 'cliente',
    });
    expect(crearAuthProvider(cognito).modo).toBe('cognito');
  });
});

describe('política de contraseñas', () => {
  it.each([
    ['Abcdef1!', true],
    ['Usuario123!', true],
    ['abcdef1!', false], // sin mayúscula
    ['ABCDEF1!', false], // sin minúscula
    ['Abcdefg!', false], // sin número
    ['Abcdefg1', false], // sin símbolo
    ['Ab1!', false], // corta
  ])('%s → %s', (password, valida) => {
    expect(esquemaPassword.safeParse(password).success).toBe(valida);
  });
});
