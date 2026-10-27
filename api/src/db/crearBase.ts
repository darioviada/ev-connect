// Bases auxiliares en el mismo servidor (tests: `<base>_test`; validación: `<base>_validacion`).
import { crearKnex } from './knex.js';

/** Misma URL con el nombre de base `<nombre><sufijo>`. */
export function urlConSufijo(url: string, sufijo: string): string {
  const u = new URL(url);
  u.pathname = `/${u.pathname.slice(1)}${sufijo}`;
  return u.toString();
}

/** Crea la base si no existe (conectándose a la base de mantenimiento `postgres`). */
export async function asegurarBaseDeDatos(url: string): Promise<void> {
  const nombre = decodeURIComponent(new URL(url).pathname.slice(1));
  if (!/^[a-z0-9_]+$/.test(nombre)) throw new Error(`Nombre de base inválido: ${nombre}`);
  const urlAdmin = new URL(url);
  urlAdmin.pathname = '/postgres';
  const admin = crearKnex(urlAdmin.toString());
  try {
    const existe = await admin.raw('SELECT 1 FROM pg_database WHERE datname = ?', [nombre]);
    if (existe.rows.length === 0) await admin.raw('CREATE DATABASE ??', [nombre]);
  } catch (error) {
    throw new Error(
      `No se pudo preparar la base ${nombre} en ${urlAdmin.host}. ` +
        `¿Está levantada la base (npm run db:up)? Detalle: ${(error as Error).message}`,
      { cause: error },
    );
  } finally {
    await admin.destroy();
  }
}
