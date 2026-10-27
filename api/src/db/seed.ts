// npm run db:seed [-- --reset] — carga los datos de demostración (sintéticos).
// Fase 0: solo verifica la conexión. Los datos se agregan en la Fase 1.
import { cargarConfig, ConfigError } from '../config/index.js';
import { crearKnex } from './knex.js';

async function main() {
  const reset = process.argv.includes('--reset');
  const config = cargarConfig();
  const db = crearKnex(config.databaseUrl);
  try {
    await db.raw('select 1');
    console.log(
      `Conexión a la base OK${reset ? ' (--reset recibido)' : ''}. ` +
        'Todavía no hay datos de demostración para cargar (se agregan en la Fase 1).',
    );
  } finally {
    await db.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof ConfigError ? error.message : error);
  process.exit(1);
});
