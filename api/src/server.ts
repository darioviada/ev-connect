// Punto de entrada: carga la configuración, arma la app y escucha en PORT.
import { createApp } from './app.js';
import { crearAuthProvider } from './auth/index.js';
import { cargarConfig, ConfigError, type Config } from './config/index.js';
import { crearKnex } from './db/knex.js';
import { crearLogger } from './logger.js';
import { crearGeocodingProvider } from './routing/geocodificacion/index.js';
import { CacheRutasPg, crearRoutingProvider } from './routing/index.js';

let config: Config;
try {
  config = cargarConfig();
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}

const logger = crearLogger(config);
for (const advertencia of config.advertencias) logger.warn(advertencia);

const db = crearKnex(config.databaseUrl, config.tz);
const app = createApp({
  config,
  logger,
  db,
  auth: crearAuthProvider(config),
  rutas: crearRoutingProvider(config, { cache: new CacheRutasPg(db), logger }),
  geocoding: crearGeocodingProvider(config),
  reloj: { ahora: () => new Date(), zonaHoraria: config.tz },
});

const server = app.listen(config.port, (error?: Error) => {
  if (error) {
    logger.fatal({ err: error }, `No se pudo iniciar la API en el puerto ${config.port}`);
    process.exit(1);
  }
  logger.info(
    `API escuchando en http://localhost:${config.port} (auth=${config.auth.mode}, rutas=${config.routing.provider})`,
  );
});

function apagar(senal: string) {
  logger.info(`${senal} recibido: cerrando la API…`);
  server.close(() => {
    db.destroy().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('SIGINT', () => apagar('SIGINT'));
