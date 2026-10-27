import { randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
import { createApp, type Dependencias } from '../src/app.js';
import { LocalAuthProvider } from '../src/auth/localProvider.js';
import type { Rol } from '../src/auth/tipos.js';
import { parseConfig, type Config } from '../src/config/index.js';
import { crearKnex } from '../src/db/knex.js';
import { crearLogger } from '../src/logger.js';
import { StaticGeocodingProvider } from '../src/routing/geocodificacion/index.js';
import { OfflineProvider } from '../src/routing/index.js';
import { urlBaseDePrueba } from './db/baseDePrueba.js';

export const SECRETO_DE_PRUEBA = 'x'.repeat(40);

/** Reloj fijo de los tests de la API: martes 27/10/2026, 10:00 en Córdoba (coincide con el seed de prueba). */
export const AHORA_API = new Date('2026-10-27T13:00:00Z');
export const HOY_API = '2026-10-27';

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
export function appDePrueba(opciones: Partial<Dependencias> & { db?: Knex } = {}) {
  const config = opciones.config ?? configDePrueba();
  return createApp({
    config,
    logger: crearLogger(config),
    db: opciones.db ?? crearKnex(urlBaseDePrueba()),
    auth: opciones.auth ?? authLocalDePrueba(),
    rutas: opciones.rutas ?? new OfflineProvider(),
    geocoding: opciones.geocoding ?? new StaticGeocodingProvider(),
    reloj: opciones.reloj ?? { ahora: () => AHORA_API, zonaHoraria: config.tz },
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
