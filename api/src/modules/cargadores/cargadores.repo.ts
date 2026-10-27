// Acceso a cargadores y su disponibilidad. Las coordenadas se leen con ST_Y/ST_X (lat/lng).
import type { Knex } from 'knex';
import type { CargadorMotor, FranjaMotor, TipoConector } from '../../engine/tipos.js';
import { hhmm } from '../comun/esquemas.js';

export interface FilaCargador {
  id: string;
  usuario_id: string | null;
  nombre: string;
  direccion: string | null;
  tipo: 'publico' | 'privado';
  tipo_conector: TipoConector;
  potencia: number;
  precio_kwh: number;
  estado: 'activo' | 'inactivo';
  lat: number;
  lng: number;
}

export interface FranjaJson {
  dia: FranjaMotor['dia'];
  horaInicio: string;
  horaFin: string;
}

export function columnasCargador(db: Knex, alias = 'c') {
  return [
    `${alias}.id`,
    `${alias}.usuario_id`,
    `${alias}.nombre`,
    `${alias}.direccion`,
    `${alias}.tipo`,
    `${alias}.tipo_conector`,
    `${alias}.potencia`,
    `${alias}.precio_kwh`,
    `${alias}.estado`,
    db.raw(`ST_Y(${alias}.ubicacion::geometry) AS lat`),
    db.raw(`ST_X(${alias}.ubicacion::geometry) AS lng`),
  ];
}

export const puntoGeografico = (db: Knex, p: { lat: number; lng: number }) =>
  db.raw('ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography', [p.lng, p.lat]);

export function aCargadorJson(f: FilaCargador, extra: { disponibilidad?: FranjaJson[] } = {}) {
  return {
    id: f.id,
    nombre: f.nombre,
    direccion: f.direccion,
    tipo: f.tipo,
    ubicacion: { lat: f.lat, lng: f.lng },
    tipoConector: f.tipo_conector,
    potenciaKw: f.potencia,
    precioKwh: f.precio_kwh,
    estado: f.estado,
    duenoId: f.usuario_id,
    ...extra,
  };
}

export function aCargadorMotor(f: FilaCargador): CargadorMotor {
  return {
    id: f.id,
    nombre: f.nombre,
    tipo: f.tipo,
    tipoConector: f.tipo_conector,
    potenciaKw: f.potencia,
    precioKwh: f.precio_kwh,
    ubicacion: { lat: f.lat, lng: f.lng },
    direccion: f.direccion,
  };
}

export async function buscarCargador(db: Knex, id: string): Promise<FilaCargador | undefined> {
  return db('cargador as c').select(columnasCargador(db)).where('c.id', id).first();
}

const ORDEN_DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

/** Franjas por cargador, ordenadas por día y hora (sin filas = 24/7). */
export async function franjasPorCargador(
  db: Knex,
  ids: readonly string[],
): Promise<Map<string, FranjaJson[]>> {
  const mapa = new Map<string, FranjaJson[]>(ids.map((id) => [id, []]));
  if (ids.length === 0) return mapa;
  const filas = await db('disponibilidad')
    .whereIn('cargador_id', ids)
    .select('cargador_id', 'dia_semana', 'hora_inicio', 'hora_fin');
  filas
    .sort(
      (a, b) =>
        ORDEN_DIAS.indexOf(a.dia_semana) - ORDEN_DIAS.indexOf(b.dia_semana) ||
        String(a.hora_inicio).localeCompare(String(b.hora_inicio)),
    )
    .forEach((f) =>
      mapa.get(f.cargador_id)?.push({
        dia: f.dia_semana,
        horaInicio: hhmm(f.hora_inicio),
        // PostgreSQL guarda 24:00 como '24:00:00'
        horaFin: hhmm(f.hora_fin),
      }),
    );
  return mapa;
}

export const aFranjaMotor = (f: FranjaJson): FranjaMotor => ({
  dia: f.dia,
  inicio: f.horaInicio,
  fin: f.horaFin,
});

export async function reemplazarFranjas(
  trx: Knex | Knex.Transaction,
  cargadorId: string,
  franjas: readonly FranjaJson[],
) {
  await trx('disponibilidad').where('cargador_id', cargadorId).delete();
  if (franjas.length > 0) {
    await trx('disponibilidad').insert(
      franjas.map((f) => ({
        cargador_id: cargadorId,
        dia_semana: f.dia,
        hora_inicio: f.horaInicio,
        hora_fin: f.horaFin,
      })),
    );
  }
}
