import knex, { type Knex } from 'knex';
import pg from 'pg';

// Tipos de PostgreSQL → JavaScript:
// - date (OID 1082) como texto 'YYYY-MM-DD': evita que el driver lo convierta a Date con corrimiento de zona.
// - numeric (OID 1700) como número: los valores del dominio (kWh, kW, ARS) entran holgados en un double.
pg.types.setTypeParser(1082, (valor: string) => valor);
pg.types.setTypeParser(1700, (valor: string) => Number.parseFloat(valor));

export function crearKnex(databaseUrl: string, zonaHoraria = 'America/Argentina/Cordoba'): Knex {
  return knex({
    client: 'pg',
    connection: databaseUrl,
    pool: {
      min: 0,
      max: 10,
      // Zona horaria de negocio en cada conexión (current_date, now()).
      afterCreate: (
        conexion: pg.Client,
        listo: (error: Error | null, conexion: pg.Client) => void,
      ) => {
        conexion
          .query("SELECT set_config('TimeZone', $1, false)", [zonaHoraria])
          .then(() => listo(null, conexion))
          .catch((error: Error) => listo(error, conexion));
      },
    },
  });
}
