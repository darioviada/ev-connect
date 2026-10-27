import { randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
import { createApp } from '../src/app.js';
import { LocalAuthProvider } from '../src/auth/localProvider.js';
import type { AuthProvider, Rol } from '../src/auth/tipos.js';
import { parseConfig, type Config } from '../src/config/index.js';
import { crearKnex } from '../src/db/knex.js';
import { crearLogger } from '../src/logger.js';
import { urlBaseDePrueba } from './db/baseDePrueba.js';

export const SECRETO_DE_PRUEBA = 'x'.repeat(40);

export const ENTORNO_MINIMO = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://tfg:tfg@localhost:5432/tfg',
  AUTH_MODE: 'local',
  JWT_SECRET: SECRETO_DE_PRUEBA,
} as const;

export function configDePrueba(extra: Record<string, string> = {}): Config {
  return parseConfig({ ...ENTORNO_MINIMO, ...extra });
}

export const authLocalDePrueba = () => new LocalAuthProvider(SECRETO_DE_PRUEBA);

/**
 * App completa para tests. Si no se pasa `db`, usa la base de pruebas (knex no se conecta
 * hasta la primera consulta, así que los tests que no tocan la base no la necesitan).
 */
export function appDePrueba(opciones: { config?: Config; db?: Knex; auth?: AuthProvider } = {}) {
  const config = opciones.config ?? configDePrueba();
  return createApp({
    config,
    logger: crearLogger(config),
    db: opciones.db ?? crearKnex(urlBaseDePrueba()),
    auth: opciones.auth ?? authLocalDePrueba(),
  });
}

/** Token local válido para una identidad nueva (el usuario se crea al usarlo por primera vez). */
export function tokenDePrueba(
  rol: Rol = 'user',
  datos: { sub?: string; email?: string; nombre?: string } = {},
) {
  const sub = datos.sub ?? randomUUID();
  return authLocalDePrueba().firmar({
    sub,
    email: datos.email ?? `${sub}@test.local`,
    nombre: datos.nombre ?? 'Persona de prueba',
    rol,
  });
}
