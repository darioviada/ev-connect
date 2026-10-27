// Base de datos para tests de integración: `<base>_test` en el mismo servidor (o TEST_DATABASE_URL).
// Se crea si no existe y se migra al empezar. Nunca toca la base de desarrollo.
import type { Knex } from 'knex';
import { cargarArchivoEnv } from '../../src/config/index.js';
import { crearKnex } from '../../src/db/knex.js';
import { migrarTodo } from '../../src/db/migraciones.js';

export function urlBaseDePrueba(): string {
  cargarArchivoEnv();
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const base = process.env.DATABASE_URL;
  if (!base)
    throw new Error('Falta DATABASE_URL (o TEST_DATABASE_URL) para los tests de integración.');
  const url = new URL(base);
  url.pathname = `/${url.pathname.slice(1)}_test`;
  return url.toString();
}

export async function prepararBaseDePrueba(): Promise<Knex> {
  const url = urlBaseDePrueba();
  const nombre = decodeURIComponent(new URL(url).pathname.slice(1));
  if (!/^[a-z0-9_]+$/.test(nombre)) throw new Error(`Nombre de base de prueba inválido: ${nombre}`);

  const urlAdmin = new URL(url);
  urlAdmin.pathname = '/postgres';
  const admin = crearKnex(urlAdmin.toString());
  try {
    const existe = await admin.raw('SELECT 1 FROM pg_database WHERE datname = ?', [nombre]);
    if (existe.rows.length === 0) await admin.raw('CREATE DATABASE ??', [nombre]);
  } catch (error) {
    throw new Error(
      `No se pudo preparar la base de pruebas en ${urlAdmin.host}. ` +
        `¿Está levantada la base (npm run db:up)? Detalle: ${(error as Error).message}`,
      { cause: error },
    );
  } finally {
    await admin.destroy();
  }

  const db = crearKnex(url);
  await migrarTodo(db, 'local');
  return db;
}

/** Ejecuta `fn` dentro de una transacción que siempre se revierte (los tests no dejan rastros). */
export async function enTransaccion(db: Knex, fn: (trx: Knex.Transaction) => Promise<void>) {
  const trx = await db.transaction();
  try {
    await fn(trx);
  } finally {
    await trx.rollback();
  }
}

/** Ejecuta una operación en un savepoint y devuelve el código de error de PostgreSQL (o null). */
export async function codigoDeError(
  trx: Knex.Transaction,
  operacion: (t: Knex.Transaction) => Promise<unknown>,
): Promise<string | null> {
  try {
    await trx.transaction(async (t) => {
      await operacion(t);
    });
    return null;
  } catch (error) {
    return (error as { code?: string }).code ?? 'SIN_CODIGO';
  }
}

export const PG = {
  VIOLACION_EXCLUSION: '23P01',
  VIOLACION_CHECK: '23514',
  VIOLACION_UNICA: '23505',
  RANGO_INVALIDO: '22000',
} as const;
