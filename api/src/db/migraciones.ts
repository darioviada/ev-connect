// Ejecución de migraciones (la usan el comando `npm run db:migrate` y los tests de integración).
// `migrations/` siempre; `migrations_dev/` solo con AUTH_MODE=local y con su propia tabla de control,
// para que una base migrada en modo local no rompa al migrar luego en modo Cognito (y viceversa).
import type { Knex } from 'knex';
import { directorios, extension } from './rutas.js';

export interface ConjuntoMigraciones {
  nombre: string;
  directory: string;
  tableName: string;
}

export function conjuntosDeMigraciones(modoAuth: 'local' | 'cognito'): ConjuntoMigraciones[] {
  const conjuntos = [
    { nombre: 'Esquema', directory: directorios.migraciones, tableName: 'knex_migrations' },
  ];
  if (modoAuth === 'local') {
    conjuntos.push({
      nombre: 'Solo modo local',
      directory: directorios.migracionesDev,
      tableName: 'knex_migrations_dev',
    });
  }
  return conjuntos;
}

/** Aplica las migraciones pendientes. Devuelve los nombres aplicados por conjunto. */
export async function migrarTodo(
  db: Knex,
  modoAuth: 'local' | 'cognito',
): Promise<{ nombre: string; aplicadas: string[] }[]> {
  const resultado = [];
  for (const c of conjuntosDeMigraciones(modoAuth)) {
    const [, aplicadas] = (await db.migrate.latest({
      directory: c.directory,
      tableName: c.tableName,
      loadExtensions: [extension],
    })) as [number, string[]];
    resultado.push({ nombre: c.nombre, aplicadas });
  }
  return resultado;
}

/** Revierte todas las migraciones (primero las de desarrollo, que dependen del esquema). */
export async function revertirTodo(db: Knex, modoAuth: 'local' | 'cognito'): Promise<void> {
  for (const c of conjuntosDeMigraciones(modoAuth).reverse()) {
    await db.migrate.rollback(
      { directory: c.directory, tableName: c.tableName, loadExtensions: [extension] },
      true,
    );
  }
}
