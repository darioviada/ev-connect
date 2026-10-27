// Esquema inicial (docs/SPEC.md §5). Las líneas marcadas con EXT son agregados de la implementación
// respecto del DER del informe (ver SPEC §15). Knex ejecuta cada migración dentro de una transacción.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE EXTENSION IF NOT EXISTS btree_gist;

    CREATE TYPE tipo_conector   AS ENUM ('TIPO_2','CCS_COMBO','CHADEMO');
    CREATE TYPE tipo_cargador   AS ENUM ('publico','privado');
    CREATE TYPE estado_cargador AS ENUM ('activo','inactivo');
    CREATE TYPE estado_reserva  AS ENUM ('pendiente','confirmada','cancelada');
    CREATE TYPE dia_semana      AS ENUM ('lunes','martes','miercoles','jueves','viernes','sabado','domingo');

    CREATE TABLE usuario (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      cognito_sub text UNIQUE NOT NULL,          -- en modo local: uuid generado
      nombre text NOT NULL,
      email text UNIQUE NOT NULL,
      fecha_registro date NOT NULL DEFAULT current_date,
      activo boolean NOT NULL DEFAULT true       -- EXT
    );

    CREATE TABLE vehiculo_modelo (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      marca text NOT NULL, modelo text NOT NULL,
      capacidad_bateria numeric(6,2) NOT NULL CHECK (capacidad_bateria > 0),  -- kWh
      consumo numeric(5,2) NOT NULL CHECK (consumo > 0),                      -- kWh/100 km
      tipo_conector tipo_conector NOT NULL,
      potencia_max_ac numeric(5,1) NOT NULL,                                  -- EXT kW
      potencia_max_dc numeric(5,1),                                           -- EXT kW (NULL = sin carga DC)
      UNIQUE (marca, modelo)
    );

    CREATE TABLE vehiculo_usuario (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
      modelo_id uuid REFERENCES vehiculo_modelo(id),   -- NULL = vehículo personalizado
      marca text, modelo text, capacidad_bateria numeric(6,2), consumo numeric(5,2),
      tipo_conector tipo_conector, potencia_max_ac numeric(5,1), potencia_max_dc numeric(5,1),
      CHECK (modelo_id IS NOT NULL OR (marca IS NOT NULL AND modelo IS NOT NULL AND capacidad_bateria IS NOT NULL
             AND consumo IS NOT NULL AND tipo_conector IS NOT NULL AND potencia_max_ac IS NOT NULL))
    );
    CREATE INDEX vehiculo_usuario_usuario_idx ON vehiculo_usuario (usuario_id);

    -- Resuelve los datos del vehículo: los propios si existen; si no, los del catálogo.
    CREATE VIEW vehiculo_usuario_detalle AS
    SELECT vu.id,
           vu.usuario_id,
           vu.modelo_id,
           (vu.modelo_id IS NULL)                              AS personalizado,
           COALESCE(vu.marca, vm.marca)                        AS marca,
           COALESCE(vu.modelo, vm.modelo)                      AS modelo,
           COALESCE(vu.capacidad_bateria, vm.capacidad_bateria) AS capacidad_bateria,
           COALESCE(vu.consumo, vm.consumo)                    AS consumo,
           COALESCE(vu.tipo_conector, vm.tipo_conector)        AS tipo_conector,
           COALESCE(vu.potencia_max_ac, vm.potencia_max_ac)    AS potencia_max_ac,
           COALESCE(vu.potencia_max_dc, vm.potencia_max_dc)    AS potencia_max_dc
      FROM vehiculo_usuario vu
      LEFT JOIN vehiculo_modelo vm ON vm.id = vu.modelo_id;

    CREATE TABLE cargador (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_id uuid REFERENCES usuario(id) ON DELETE SET NULL,   -- NULL en públicos
      nombre text NOT NULL, direccion text,                          -- EXT
      tipo tipo_cargador NOT NULL,
      ubicacion geography(Point,4326) NOT NULL,
      tipo_conector tipo_conector NOT NULL,
      potencia numeric(5,1) NOT NULL CHECK (potencia > 0),           -- kW
      precio_kwh numeric(8,2) NOT NULL CHECK (precio_kwh >= 0),      -- EXT (ARS por kWh)
      estado estado_cargador NOT NULL DEFAULT 'activo',
      CHECK (tipo = 'publico' OR usuario_id IS NOT NULL)
    );
    CREATE INDEX cargador_ubicacion_gix ON cargador USING gist (ubicacion);
    CREATE INDEX cargador_usuario_idx ON cargador (usuario_id);

    CREATE TABLE disponibilidad (   -- sin filas = disponible 24/7
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      cargador_id uuid NOT NULL REFERENCES cargador(id) ON DELETE CASCADE,
      dia_semana dia_semana NOT NULL, hora_inicio time NOT NULL, hora_fin time NOT NULL,
      CHECK (hora_fin > hora_inicio)
    );
    CREATE INDEX disponibilidad_cargador_idx ON disponibilidad (cargador_id);

    CREATE TABLE reserva (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
      cargador_id uuid NOT NULL REFERENCES cargador(id) ON DELETE CASCADE,
      fecha date NOT NULL, hora_inicio time NOT NULL, hora_fin time NOT NULL,
      estado estado_reserva NOT NULL DEFAULT 'confirmada',
      CHECK (hora_fin > hora_inicio),
      rango tsrange GENERATED ALWAYS AS (tsrange(fecha + hora_inicio, fecha + hora_fin)) STORED,  -- EXT
      EXCLUDE USING gist (cargador_id WITH =, rango WITH &&) WHERE (estado <> 'cancelada')       -- evita solapes
    );
    CREATE INDEX reserva_usuario_idx ON reserva (usuario_id);

    CREATE TABLE ruta_guardada (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
      nombre text NOT NULL,
      origen_lat double precision NOT NULL, origen_lng double precision NOT NULL,
      destino_lat double precision NOT NULL, destino_lng double precision NOT NULL
    );
    CREATE INDEX ruta_guardada_usuario_idx ON ruta_guardada (usuario_id);

    CREATE TABLE favorito (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
      cargador_id uuid NOT NULL REFERENCES cargador(id) ON DELETE CASCADE,
      UNIQUE (usuario_id, cargador_id)
    );

    -- EXT (infraestructura): caché de resultados de la Routes API (control de costo)
    CREATE TABLE cache_ruta (
      clave text PRIMARY KEY, distancia_m integer NOT NULL, duracion_s integer NOT NULL,
      creado timestamptz NOT NULL DEFAULT now()
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Las extensiones se dejan instaladas (pueden usarlas otros objetos de la base).
  await knex.raw(`
    DROP TABLE IF EXISTS cache_ruta, favorito, ruta_guardada, reserva, disponibilidad, cargador;
    DROP VIEW IF EXISTS vehiculo_usuario_detalle;
    DROP TABLE IF EXISTS vehiculo_usuario, vehiculo_modelo, usuario;
    DROP TYPE IF EXISTS dia_semana, estado_reserva, estado_cargador, tipo_cargador, tipo_conector;
  `);
}
