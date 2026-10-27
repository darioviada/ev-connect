// Ubicación de migraciones y seeds. Funciona igual desde el código fuente (tsx, archivos .ts)
// y desde el build (node dist/..., archivos .js): las carpetas quedan en la misma posición relativa.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url)); // <raíz>/src/db
const raiz = path.resolve(aqui, '..', '..'); // api/ o api/dist/

export const extension = import.meta.url.endsWith('.ts') ? '.ts' : '.js';

export const directorios = {
  migraciones: path.join(raiz, 'migrations'),
  migracionesDev: path.join(raiz, 'migrations_dev'),
  seeds: path.join(raiz, 'seeds'),
};
