// Carga el archivo .env (si existe) y devuelve la configuración validada.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parseConfig, type Config } from './env.js';

export { ConfigError, JWT_SECRET_DEMO, parseConfig, type Config } from './env.js';

/**
 * Busca un .env subiendo desde `desde` (el script de npm corre en `api/`, el archivo vive en la raíz).
 * Las variables ya definidas en el entorno tienen prioridad (útil en contenedores).
 */
export function cargarArchivoEnv(desde = process.cwd(), niveles = 3): string | undefined {
  let dir = path.resolve(desde);
  for (let i = 0; i <= niveles; i++) {
    const archivo = path.join(dir, '.env');
    if (existsSync(archivo)) {
      process.loadEnvFile(archivo);
      return archivo;
    }
    const padre = path.dirname(dir);
    if (padre === dir) break;
    dir = padre;
  }
  return undefined;
}

export function cargarConfig(): Config {
  cargarArchivoEnv();
  return parseConfig(process.env);
}
