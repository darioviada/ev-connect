import knex, { type Knex } from 'knex';

export function crearKnex(databaseUrl: string): Knex {
  return knex({
    client: 'pg',
    connection: databaseUrl,
    pool: { min: 0, max: 10 },
  });
}
