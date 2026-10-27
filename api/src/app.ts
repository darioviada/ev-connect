// Construye la aplicación Express sin abrir puertos (así se puede testear con supertest).
import { existsSync } from 'node:fs';
import path from 'node:path';
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
  // Detrás del balanceador, la IP real del cliente (para el límite de solicitudes) viene en X-Forwarded-For.
  if (config.trustProxy > 0) app.set('trust proxy', config.trustProxy);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          // Leaflet y React aplican estilos en línea
          styleSrc: ["'self'", "'unsafe-inline'"],
          // Mosaicos de OpenStreetMap (con su atribución visible en el mapa)
          imgSrc: ["'self'", 'data:', 'https://tile.openstreetmap.org'],
          fontSrc: ["'self'", 'data:'],
          // Amazon Cognito (modo cognito: Amplify habla directo con el User Pool)
          connectSrc: ["'self'", 'https://*.amazonaws.com'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          // La demo local corre por http://localhost: no forzar https (en la nube lo resuelve el balanceador)
          upgradeInsecureRequests: null,
        },
      },
    }),
  );
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

  // Producción: la misma imagen sirve el build de la web (un solo artefacto, ver docs/AWS_DEPLOY.md).
  // Cualquier GET que no sea de la API devuelve index.html (el ruteo lo resuelve React Router).
  if (config.webDist && existsSync(path.join(config.webDist, 'index.html'))) {
    const indice = path.resolve(config.webDist, 'index.html');
    app.use(
      express.static(config.webDist, {
        index: false,
        setHeaders: (res, archivo) => {
          // Los archivos de /assets llevan un hash en el nombre: se pueden cachear mucho tiempo
          if (archivo.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      }),
    );
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
      res.sendFile(indice);
    });
  }

  app.use(noEncontrado);
  app.use(manejadorErrores(logger));

  return app;
}
