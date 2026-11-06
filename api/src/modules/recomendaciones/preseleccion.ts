// SPEC §6.6 — Preselección espacial antes del motor: limita los candidatos (y los elementos consultados a la
// Routes API, que tienen costo).
// - Modo ubicación: radio SEARCH_RADIUS_KM alrededor del origen, por distancia.
// - Modo ruta: corredor CORRIDOR_KM alrededor de la línea origen→destino, repartido en tramos (D-025):
//   el más cercano a la línea en cada tramo y, si sobran lugares, los más cercanos a la línea.
//   Con `alcanceKm` (D-044) los tramos cubren solo la parte de la ruta alcanzable con la batería actual y
//   se excluyen los cargadores a más de esa distancia en línea recta del origen (la distancia por ruta
//   nunca es menor que la recta, así que no se pierde ningún cargador alcanzable).
// - Solo conectores compatibles (D-027). Si hay menos de 3, se amplía una vez (×2).
import type { Knex } from 'knex';
import type { LatLng, TipoConector } from '../../engine/tipos.js';
import {
  columnasCargador,
  puntoGeografico,
  type FilaCargador,
} from '../cargadores/cargadores.repo.js';

export interface ParametrosPreseleccion {
  modo: 'ubicacion' | 'ruta';
  origen: LatLng;
  destino?: LatLng;
  conectores: readonly TipoConector[];
  radioKm: number;
  corredorKm: number;
  limite: number;
  /** Solo modo ruta: distancia máxima alcanzable desde el origen (km). */
  alcanceKm?: number;
}

export interface Preseleccion {
  filas: FilaCargador[];
  /** Radio o ancho de corredor finalmente usado (km). */
  distanciaKm: number;
  ampliada: boolean;
}

const MINIMO_CANDIDATOS = 3;

function porRadio(
  db: Knex,
  origen: LatLng,
  conectores: readonly TipoConector[],
  km: number,
  limite: number,
) {
  const punto = puntoGeografico(db, origen);
  return db('cargador as c')
    .select(columnasCargador(db))
    .where('c.estado', 'activo')
    .whereIn('c.tipo_conector', conectores)
    .whereRaw('ST_DWithin(c.ubicacion, ?, ?)', [punto, km * 1000])
    .orderByRaw('ST_Distance(c.ubicacion, ?), c.id', [punto])
    .limit(limite) as Promise<FilaCargador[]>;
}

async function porCorredor(
  db: Knex,
  origen: LatLng,
  destino: LatLng,
  conectores: readonly TipoConector[],
  km: number,
  limite: number,
  alcanceKm: number | undefined,
): Promise<FilaCargador[]> {
  const alcanceM = alcanceKm === undefined ? null : alcanceKm * 1000;
  // Los conectores son valores de un enum propio (no texto del usuario); igual van como parámetro.
  const arregloConectores = `{${conectores.join(',')}}`;
  const { rows } = await db.raw(
    `WITH linea AS (
       SELECT ST_MakeLine(ST_SetSRID(ST_MakePoint(?, ?), 4326),
                          ST_SetSRID(ST_MakePoint(?, ?), 4326)) AS g
     ),
     -- Fracción de la línea dentro del alcance: ahí se reparten los tramos.
     param AS (
       SELECT ST_StartPoint(linea.g)::geography AS origen,
              LEAST(1, COALESCE(?::float8, 'Infinity') / GREATEST(ST_Length(linea.g::geography), 1)) AS frac
         FROM linea
     ),
     cand AS (
       SELECT c.id, c.usuario_id, c.nombre, c.direccion, c.tipo, c.tipo_conector, c.potencia,
              c.precio_kwh, c.estado,
              ST_Y(c.ubicacion::geometry) AS lat, ST_X(c.ubicacion::geometry) AS lng,
              ST_Distance(c.ubicacion, linea.g::geography) AS dist_linea,
              LEAST(FLOOR(ST_LineLocatePoint(linea.g, c.ubicacion::geometry) / param.frac * ?)::int,
                    ? - 1) AS tramo
         FROM cargador c, linea, param
        WHERE c.estado = 'activo'
          AND c.tipo_conector = ANY(?::tipo_conector[])
          AND ST_DWithin(c.ubicacion, linea.g::geography, ?)
          AND (?::float8 IS NULL OR ST_DWithin(c.ubicacion, param.origen, ?::float8))
     ),
     orden AS (
       SELECT cand.*, ROW_NUMBER() OVER (PARTITION BY tramo ORDER BY dist_linea, id) AS n
         FROM cand
     )
     SELECT id, usuario_id, nombre, direccion, tipo, tipo_conector, potencia, precio_kwh, estado, lat, lng
       FROM orden
      ORDER BY (n = 1) DESC, dist_linea, id
      LIMIT ?`,
    [
      origen.lng,
      origen.lat,
      destino.lng,
      destino.lat,
      alcanceM,
      limite,
      limite,
      arregloConectores,
      km * 1000,
      alcanceM,
      alcanceM,
      limite,
    ],
  );
  return rows as FilaCargador[];
}

export async function preseleccionar(db: Knex, p: ParametrosPreseleccion): Promise<Preseleccion> {
  const buscar = (km: number) =>
    p.modo === 'ruta'
      ? porCorredor(db, p.origen, p.destino!, p.conectores, km, p.limite, p.alcanceKm)
      : porRadio(db, p.origen, p.conectores, km, p.limite);

  const base = p.modo === 'ruta' ? p.corredorKm : p.radioKm;
  const filas = await buscar(base);
  if (filas.length >= MINIMO_CANDIDATOS) return { filas, distanciaKm: base, ampliada: false };
  return { filas: await buscar(base * 2), distanciaKm: base * 2, ampliada: true };
}
