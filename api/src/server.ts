// Punto de entrada: carga la configuración, arma la app y escucha en PORT.
import { createApp } from './app.js';
import { cargarConfig, ConfigError, type Config } from './config/index.js';
import { crearLogger } from './logger.js';

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

const app = createApp({ config, logger });

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
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('SIGINT', () => apagar('SIGINT'));
