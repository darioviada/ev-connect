// npm run db:migrate            → aplica las migraciones pendientes
// npm run db:migrate -- --down  → revierte todas (útil en desarrollo; borra los datos)
import { cargarConfig, ConfigError } from '../config/index.js';
import { crearKnex } from './knex.js';
import { migrarTodo, revertirTodo } from './migraciones.js';

async function main() {
  const config = cargarConfig();
  const db = crearKnex(config.databaseUrl, config.tz);
  try {
    if (process.argv.includes('--down')) {
      await revertirTodo(db, config.auth.mode);
      console.log('Migraciones revertidas.');
      return;
    }
    for (const { nombre, aplicadas } of await migrarTodo(db, config.auth.mode)) {
      if (aplicadas.length === 0) {
        console.log(`${nombre}: sin migraciones pendientes.`);
      } else {
        console.log(`${nombre}: ${aplicadas.length} migración(es) aplicada(s):`);
        for (const m of aplicadas) console.log(`  - ${m}`);
      }
    }
  } finally {
    await db.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof ConfigError ? error.message : error);
  process.exit(1);
});
