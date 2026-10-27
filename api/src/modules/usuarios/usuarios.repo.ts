// Acceso a la tabla `usuario`.
import type { Knex } from 'knex';
import type { Identidad } from '../../auth/tipos.js';
import { AppError } from '../../errors.js';

export interface UsuarioFila {
  id: string;
  cognito_sub: string;
  nombre: string;
  email: string;
  fecha_registro: string;
  activo: boolean;
}

export const normalizarEmail = (email: string) => email.trim().toLowerCase();

export const esViolacionUnica = (error: unknown) =>
  (error as { code?: string } | null)?.code === '23505';

const emailEnUso = () =>
  new AppError(409, 'EMAIL_EN_USO', 'Ya existe una cuenta con ese correo electrónico.');

/**
 * Devuelve el usuario del token y lo crea si es la primera vez que se lo ve (*upsert* por `sub`).
 * Si el correo cambió en el proveedor de identidad, lo actualiza.
 */
export async function asegurarUsuario(db: Knex, identidad: Identidad): Promise<UsuarioFila> {
  const email = normalizarEmail(identidad.email);
  const existente = await db<UsuarioFila>('usuario').where('cognito_sub', identidad.sub).first();

  if (existente) {
    if (existente.email === email) return existente;
    try {
      const [actualizado] = await db<UsuarioFila>('usuario')
        .where('id', existente.id)
        .update({ email })
        .returning('*');
      return actualizado!;
    } catch (error) {
      if (esViolacionUnica(error)) throw emailEnUso();
      throw error;
    }
  }

  try {
    const [creado] = await db<UsuarioFila>('usuario')
      .insert({
        cognito_sub: identidad.sub,
        nombre: identidad.nombre?.trim() || email.split('@')[0]!,
        email,
      })
      .onConflict('cognito_sub')
      .ignore()
      .returning('*');
    // Si otra solicitud simultánea lo creó primero, el insert no devuelve filas.
    return (
      creado ?? (await db<UsuarioFila>('usuario').where('cognito_sub', identidad.sub).first())!
    );
  } catch (error) {
    if (esViolacionUnica(error)) throw emailEnUso();
    throw error;
  }
}
