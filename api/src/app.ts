// Construye la aplicación Express sin abrir puertos (así se puede testear con supertest).
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';
import type { Config } from './config/index.js';
import { manejadorErrores, noEncontrado } from './middleware/errores.js';
import { saludRouter } from './modules/salud/salud.routes.js';

export const API_PREFIX = '/api/v1';

export interface Dependencias {
  config: Config;
  logger: Logger;
}

export function createApp({ config, logger }: Dependencias): Express {
  const app = express();

  app.use(
    pinoHttp({
      logger,
      // Solo método, ruta (sin query, que puede traer direcciones) y estado: sin datos personales.
      serializers: {
        req: (req: { method: string; url: string }) => ({
          method: req.method,
          url: req.url.split('?')[0],
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
      autoLogging: { ignore: (req) => req.url === `${API_PREFIX}/salud` },
    }),
  );
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: '100kb' }));

  const api = express.Router();
  api.use('/salud', saludRouter());
  app.use(API_PREFIX, api);

  app.use(noEncontrado);
  app.use(manejadorErrores(logger));

  return app;
}
