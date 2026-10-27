import { createApp } from '../src/app.js';
import { parseConfig, type Config } from '../src/config/index.js';
import { crearLogger } from '../src/logger.js';

export const ENTORNO_MINIMO = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://tfg:tfg@localhost:5432/tfg',
  AUTH_MODE: 'local',
  JWT_SECRET: 'x'.repeat(40),
} as const;

export function configDePrueba(extra: Record<string, string> = {}): Config {
  return parseConfig({ ...ENTORNO_MINIMO, ...extra });
}

export function appDePrueba(config = configDePrueba()) {
  return createApp({ config, logger: crearLogger(config) });
}
