// Construye la aplicación Express sin abrir puertos (así se puede testear con supertest).
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { LocalAuthProvider } from './auth/localProvider.js';
import { manejadorErrores, noEncontrado } from './middleware/errores.js';
import { adminUsuariosRouter } from './modules/admin/usuarios.routes.js';
import { authLocalRouter } from './modules/auth-local/authLocal.routes.js';
import { cargadoresRouter } from './modules/cargadores/cargadores.routes.js';
import type { DependenciasApi } from './modules/comun/dependencias.js';
import { favoritosRouter } from './modules/favoritos/favoritos.routes.js';
import { geocodificacionRouter } from './modules/geocodificacion/geocodificacion.routes.js';
import { recomendacionesRouter } from './modules/recomendaciones/recomendaciones.routes.js';
import { reservasRouter } from './modules/reservas/reservas.routes.js';
import { saludRouter } from './modules/salud/salud.routes.js';
import { yoRouter } from './modules/usuarios/yo.routes.js';
import { vehiculosRouter } from './modules/vehiculos/vehiculos.routes.js';

export const API_PREFIX = '/api/v1';

export type Dependencias = DependenciasApi;

export function createApp(deps: DependenciasApi): Express {
  const { config, logger, db, auth } = deps;
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
  if (auth instanceof LocalAuthProvider) {
    api.use('/auth/local', authLocalRouter({ db, auth }));
  }
  api.use('/yo', yoRouter({ auth, db }));
  api.use(vehiculosRouter(deps));
  api.use(cargadoresRouter(deps));
  api.use(recomendacionesRouter(deps));
  api.use(reservasRouter(deps));
  api.use(favoritosRouter(deps));
  api.use(geocodificacionRouter(deps));
  api.use(adminUsuariosRouter(deps));
  app.use(API_PREFIX, api);

  app.use(noEncontrado);
  app.use(manejadorErrores(logger));

  return app;
}
