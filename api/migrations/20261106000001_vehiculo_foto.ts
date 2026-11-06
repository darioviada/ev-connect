// EXT (D-047): foto de cada modelo del catálogo. Se guarda en la base (bytea) para que el contenedor siga sin
// estado (en AWS va a RDS con el resto de los datos, sin S3). Tabla aparte para que el listado del catálogo
// no cargue las imágenes.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE vehiculo_foto (
      modelo_id uuid PRIMARY KEY REFERENCES vehiculo_modelo(id) ON DELETE CASCADE,
      contenido bytea NOT NULL,
      tipo_mime text NOT NULL CHECK (tipo_mime IN ('image/jpeg', 'image/png', 'image/webp')),
      credito text CHECK (char_length(credito) <= 300),     -- autor y licencia, p. ej. "Foto: X · CC BY-SA 4.0"
      fuente_url text CHECK (char_length(fuente_url) <= 500),
      actualizado timestamptz NOT NULL DEFAULT now(),
      CHECK (octet_length(contenido) <= 2 * 1024 * 1024)
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TABLE IF EXISTS vehiculo_foto;');
}
