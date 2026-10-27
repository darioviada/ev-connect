// SOLO MODO LOCAL (AUTH_MODE=local): credenciales de desarrollo. Nunca se aplica en la nube,
// donde las contraseñas las gestiona Amazon Cognito.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE dev_credencial (
      usuario_id uuid PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
      password_hash text NOT NULL,
      rol text NOT NULL DEFAULT 'user' CHECK (rol IN ('user','admin'))
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TABLE IF EXISTS dev_credencial;');
}
