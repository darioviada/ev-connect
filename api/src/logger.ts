import { pino, type Logger } from 'pino';
import type { Config } from './config/index.js';

export function crearLogger(config: Pick<Config, 'nodeEnv' | 'logLevel'>): Logger {
  return pino({
    level: config.nodeEnv === 'test' ? 'silent' : config.logLevel,
    // Nunca loguear credenciales ni datos personales.
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.email'],
      remove: true,
    },
    // En desarrollo, salida legible (pino-pretty es dependencia de desarrollo).
    ...(config.nodeEnv === 'development'
      ? {
          transport: {
            target: 'pino-pretty',
            options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
          },
        }
      : {}),
  });
}
