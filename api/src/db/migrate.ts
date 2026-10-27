// npm run db:migrate — aplica las migraciones pendientes.
// `migrations/` siempre; `migrations_dev/` solo con AUTH_MODE=local y con su propia tabla de control,
// para que una base migrada en modo local no rompa al migrar luego en modo Cognito (y viceversa).
import { cargarConfig, ConfigError } from '../config/index.js';
import { crearKnex } from './knex.js';
import { directorios, extension } from './rutas.js';

async function main() {
  const config = cargarConfig();
  const db = crearKnex(config.databaseUrl);

  const conjuntos = [
    { nombre: 'Esquema', directory: directorios.migraciones, tableName: 'knex_migrations' },
  ];
  if (config.auth.mode === 'local') {
    conjuntos.push({
      nombre: 'Solo modo local',
      directory: directorios.migracionesDev,
      tableName: 'knex_migrations_dev',
    });
  }

  try {
    for (const c of conjuntos) {
      const [, aplicadas] = (await db.migrate.latest({
        directory: c.directory,
        tableName: c.tableName,
        loadExtensions: [extension],
      })) as [number, string[]];
      if (aplicadas.length === 0) {
        console.log(`${c.nombre}: sin migraciones pendientes.`);
      } else {
        console.log(`${c.nombre}: ${aplicadas.length} migración(es) aplicada(s):`);
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
