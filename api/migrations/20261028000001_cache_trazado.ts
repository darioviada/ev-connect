// EXT (infraestructura): caché del trazado de rutas de Google (computeRoutes) para dibujar el camino real en
// el mapa. Mismo criterio que cache_ruta: clave con coordenadas redondeadas, TTL de 7 días (control de costo).
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE cache_trazado (
      clave text PRIMARY KEY,
      polyline text NOT NULL,          -- Encoded Polyline de Google
      distancia_m integer NOT NULL,
      duracion_s integer NOT NULL,
      creado timestamptz NOT NULL DEFAULT now()
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TABLE IF EXISTS cache_trazado;');
}
