import { describe, expect, it } from 'vitest';
import { ConfigError, JWT_SECRET_DEMO, parseConfig, parseConfigBase } from '../src/config/index.js';
import { ENTORNO_MINIMO } from './helpers.js';

function problemas(entorno: Record<string, string | undefined>): string[] {
  try {
    parseConfig(entorno);
  } catch (error) {
    if (error instanceof ConfigError) return error.problemas;
    throw error;
  }
  throw new Error('Se esperaba ConfigError');
}

describe('parseConfig', () => {
  it('aplica valores por defecto con el entorno mínimo', () => {
    const config = parseConfig(ENTORNO_MINIMO);
    expect(config.port).toBe(3000);
    expect(config.auth).toEqual({ mode: 'local', jwtSecret: ENTORNO_MINIMO.JWT_SECRET });
    expect(config.routing.provider).toBe('offline');
    expect(config.geocoding.provider).toBe('static');
    expect(config.engine).toEqual({ candidatesLimit: 8, searchRadiusKm: 20, corridorKm: 5 });
    expect(config.tz).toBe('America/Argentina/Cordoba');
  });

  it('falla con un mensaje claro si falta DATABASE_URL', () => {
    const { DATABASE_URL: _omitida, ...resto } = ENTORNO_MINIMO;
    const lista = problemas(resto);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatch(/^DATABASE_URL: es obligatoria/);
  });

  it('trata las variables vacías como no definidas', () => {
    expect(problemas({ ...ENTORNO_MINIMO, DATABASE_URL: '  ' })[0]).toMatch(/^DATABASE_URL/);
    expect(parseConfig({ ...ENTORNO_MINIMO, PORT: '' }).port).toBe(3000);
  });

  it('rechaza valores con formato inválido', () => {
    const lista = problemas({ ...ENTORNO_MINIMO, PORT: 'abc', AUTH_MODE: 'otro' });
    expect(lista.some((p) => p.startsWith('PORT'))).toBe(true);
    expect(lista.some((p) => p.startsWith('AUTH_MODE'))).toBe(true);
  });

  it('exige JWT_SECRET de al menos 32 caracteres en modo local', () => {
    expect(problemas({ ...ENTORNO_MINIMO, JWT_SECRET: undefined })[0]).toMatch(/^JWT_SECRET/);
    expect(problemas({ ...ENTORNO_MINIMO, JWT_SECRET: 'corto' })[0]).toMatch(/32 caracteres/);
  });

  it('acepta el secreto de demostración con advertencia, salvo en producción', () => {
    const config = parseConfig({ ...ENTORNO_MINIMO, JWT_SECRET: JWT_SECRET_DEMO });
    expect(config.advertencias.some((a) => a.includes('valor de demostración'))).toBe(true);

    const lista = problemas({
      ...ENTORNO_MINIMO,
      JWT_SECRET: JWT_SECRET_DEMO,
      NODE_ENV: 'production',
    });
    expect(lista[0]).toMatch(/NODE_ENV=production/);
  });

  it('exige las variables de Cognito con AUTH_MODE=cognito', () => {
    const lista = problemas({ ...ENTORNO_MINIMO, AUTH_MODE: 'cognito' });
    expect(lista).toHaveLength(3);

    const config = parseConfig({
      ...ENTORNO_MINIMO,
      AUTH_MODE: 'cognito',
      JWT_SECRET: '',
      COGNITO_REGION: 'us-east-1',
      COGNITO_USER_POOL_ID: 'us-east-1_abc',
      COGNITO_CLIENT_ID: 'cliente',
    });
    expect(config.auth.mode).toBe('cognito');
  });

  it('resuelve ROUTING_PROVIDER=auto según haya clave de Google', () => {
    expect(parseConfig({ ...ENTORNO_MINIMO, ROUTING_PROVIDER: 'auto' }).routing.provider).toBe(
      'offline',
    );
    expect(
      parseConfig({ ...ENTORNO_MINIMO, ROUTING_PROVIDER: 'auto', GOOGLE_MAPS_API_KEY: 'k' }).routing
        .provider,
    ).toBe('google');
    expect(problemas({ ...ENTORNO_MINIMO, ROUTING_PROVIDER: 'google' })[0]).toMatch(
      /^GOOGLE_MAPS_API_KEY/,
    );
  });

  it('acepta varios orígenes de CORS separados por coma', () => {
    const config = parseConfig({ ...ENTORNO_MINIMO, CORS_ORIGIN: 'http://a.test, http://b.test' });
    expect(config.corsOrigins).toEqual(['http://a.test', 'http://b.test']);
  });
});

describe('parseConfigBase (comandos de base de datos)', () => {
  it('no exige JWT_SECRET ni variables de Cognito, y acepta el secreto de demo en producción', () => {
    expect(
      parseConfigBase({
        DATABASE_URL: 'postgres://a@b/c',
        NODE_ENV: 'production',
        AUTH_MODE: 'cognito',
      }),
    ).toEqual({
      databaseUrl: 'postgres://a@b/c',
      authMode: 'cognito',
      tz: 'America/Argentina/Cordoba',
    });
  });

  it('exige DATABASE_URL', () => {
    expect(() => parseConfigBase({})).toThrow(ConfigError);
  });
});
