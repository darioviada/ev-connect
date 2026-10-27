// HU-004 publicación y gestión de cargadores · HU-005 consulta de la red colaborativa · moderación (P2).
import { Router, type Response } from 'express';
import { z } from 'zod';
import { AppError } from '../../errors.js';
import { autenticar, esDuenoOAdmin, requerirRol } from '../../middleware/auth.js';
import type { DependenciasApi } from '../comun/dependencias.js';
import { CONECTORES, esquemaFranjas, esquemaLatLng, idDe } from '../comun/esquemas.js';
import { fechaRelativa, momentoLocal } from '../comun/reloj.js';
import {
  aCargadorJson,
  buscarCargador,
  columnasCargador,
  franjasPorCargador,
  puntoGeografico,
  reemplazarFranjas,
} from './cargadores.repo.js';

const esquemaDatos = z.object({
  nombre: z.string().trim().min(1).max(80),
  direccion: z.string().trim().max(200).nullable().optional(),
  ubicacion: esquemaLatLng,
  tipoConector: z.enum(CONECTORES),
  potenciaKw: z.number().positive().max(400),
  precioKwh: z.number().min(0).max(100_000),
});

const esquemaAlta = esquemaDatos.extend({
  /** Solo un admin puede publicar cargadores públicos. */
  tipo: z.enum(['publico', 'privado']).default('privado'),
  disponibilidad: esquemaFranjas.default([]),
});

const esquemaEdicion = esquemaDatos
  .extend({ estado: z.enum(['activo', 'inactivo']) })
  .partial()
  .refine((d) => Object.keys(d).length > 0, 'Indicá al menos un dato para modificar.');

const esquemaBbox = z
  .string()
  .transform((s) => s.split(',').map(Number))
  .pipe(
    z
      .tuple([
        z.number().min(-180).max(180),
        z.number().min(-90).max(90),
        z.number().min(-180).max(180),
        z.number().min(-90).max(90),
      ])
      .refine(([minLng, minLat, maxLng, maxLat]) => minLng < maxLng && minLat < maxLat, {
        message: 'bbox debe ser minLng,minLat,maxLng,maxLat',
      }),
  );

const MAX_EN_MAPA = 500;

export function cargadoresRouter(deps: DependenciasApi): Router {
  const { db } = deps;
  const router = Router();
  const conSesion = autenticar(deps, { obligatorio: true });
  const sesionOpcional = autenticar(deps, { obligatorio: false });

  const duenoDelCargador = esDuenoOAdmin(async (req) => {
    const fila = await db('cargador').where('id', idDe(req)).first('usuario_id');
    return fila ? fila.usuario_id : undefined;
  });

  const aColumnas = (d: Partial<z.infer<typeof esquemaDatos>> & { estado?: string }) => ({
    ...(d.nombre !== undefined ? { nombre: d.nombre } : {}),
    ...(d.direccion !== undefined ? { direccion: d.direccion } : {}),
    ...(d.ubicacion ? { ubicacion: puntoGeografico(db, d.ubicacion) } : {}),
    ...(d.tipoConector ? { tipo_conector: d.tipoConector } : {}),
    ...(d.potenciaKw !== undefined ? { potencia: d.potenciaKw } : {}),
    ...(d.precioKwh !== undefined ? { precio_kwh: d.precioKwh } : {}),
    ...(d.estado ? { estado: d.estado } : {}),
  });

  async function responderCargador(id: string, status: number, res: Response) {
    const fila = (await buscarCargador(db, id))!;
    const franjas = await franjasPorCargador(db, [id]);
    res.status(status).json(aCargadorJson(fila, { disponibilidad: franjas.get(id)! }));
  }

  // Red colaborativa: cargadores activos (públicos y privados juntos), opcionalmente dentro de un bbox.
  router.get('/cargadores', async (req, res) => {
    const { bbox } = z.object({ bbox: esquemaBbox.optional() }).parse(req.query);
    const query = db('cargador as c')
      .select(columnasCargador(db))
      .where('c.estado', 'activo')
      .orderBy('c.id')
      .limit(MAX_EN_MAPA);
    if (bbox) {
      query.whereRaw('c.ubicacion::geometry && ST_MakeEnvelope(?, ?, ?, ?, 4326)', bbox);
    }
    const filas = await query;
    res.json({ items: filas.map((f) => aCargadorJson(f)), truncado: filas.length === MAX_EN_MAPA });
  });

  // Detalle: activos para todos; inactivos solo para su dueño o un admin.
  router.get('/cargadores/:id', sesionOpcional, async (req, res) => {
    const id = idDe(req);
    const fila = await buscarCargador(db, id);
    const puedeVerInactivo =
      req.usuario && (req.usuario.rol === 'admin' || req.usuario.id === fila?.usuario_id);
    if (!fila || (fila.estado === 'inactivo' && !puedeVerInactivo)) {
      throw new AppError(404, 'NO_ENCONTRADO', 'El cargador no existe o no está disponible.');
    }
    const franjas = await franjasPorCargador(db, [id]);
    // Ocupación de los próximos 7 días, sin datos de quién reservó.
    const ocupacion = await db('reserva')
      .where('cargador_id', id)
      .whereNot('estado', 'cancelada')
      .whereBetween('fecha', [momentoLocal(deps.reloj).fecha, fechaRelativa(deps.reloj, 7)])
      .orderBy(['fecha', 'hora_inicio'])
      .select('fecha', 'hora_inicio', 'hora_fin', 'estado');
    res.json({
      ...aCargadorJson(fila, { disponibilidad: franjas.get(id)! }),
      ocupacion: ocupacion.map((o) => ({
        fecha: o.fecha,
        horaInicio: String(o.hora_inicio).slice(0, 5),
        horaFin: String(o.hora_fin).slice(0, 5),
        estado: o.estado,
      })),
    });
  });

  // Publicar (HU-004)
  router.post('/cargadores', conSesion, async (req, res) => {
    const datos = esquemaAlta.parse(req.body);
    if (datos.tipo === 'publico' && req.usuario!.rol !== 'admin') {
      throw new AppError(
        403,
        'PERMISO_DENEGADO',
        'Solo un administrador puede publicar cargadores públicos.',
      );
    }
    const id = await db.transaction(async (trx) => {
      const [fila] = await trx('cargador')
        .insert({
          ...aColumnas(datos),
          tipo: datos.tipo,
          usuario_id: datos.tipo === 'privado' ? req.usuario!.id : null,
        })
        .returning('id');
      await reemplazarFranjas(trx, fila.id, datos.disponibilidad);
      return fila.id as string;
    });
    await responderCargador(id, 201, res);
  });

  router.get('/mis-cargadores', conSesion, async (req, res) => {
    const filas = await db('cargador as c')
      .select(columnasCargador(db))
      .select(
        db.raw(
          "(SELECT count(*)::int FROM reserva r WHERE r.cargador_id = c.id AND r.estado = 'pendiente') AS reservas_pendientes",
        ),
      )
      .where('c.usuario_id', req.usuario!.id)
      .orderBy(['c.nombre', 'c.id']);
    const franjas = await franjasPorCargador(
      db,
      filas.map((f) => f.id),
    );
    res.json({
      items: filas.map((f) => ({
        ...aCargadorJson(f, { disponibilidad: franjas.get(f.id)! }),
        reservasPendientes: f.reservas_pendientes,
      })),
    });
  });

  router.put('/cargadores/:id', conSesion, duenoDelCargador, async (req, res) => {
    const id = idDe(req);
    await db('cargador')
      .where('id', id)
      .update(aColumnas(esquemaEdicion.parse(req.body)));
    await responderCargador(id, 200, res);
  });

  router.put('/cargadores/:id/disponibilidad', conSesion, duenoDelCargador, async (req, res) => {
    const id = idDe(req);
    const { franjas } = z.object({ franjas: esquemaFranjas }).parse(req.body);
    await db.transaction((trx) => reemplazarFranjas(trx, id, franjas));
    await responderCargador(id, 200, res);
  });

  router.delete('/cargadores/:id', conSesion, duenoDelCargador, async (req, res) => {
    const id = idDe(req);
    // No se borra un cargador con reservas activas a futuro: conviene desactivarlo.
    const futuras = await db('reserva')
      .where('cargador_id', id)
      .whereNot('estado', 'cancelada')
      .where('fecha', '>=', momentoLocal(deps.reloj).fecha)
      .first('id');
    if (futuras) {
      throw new AppError(
        409,
        'CARGADOR_CON_RESERVAS',
        'El cargador tiene reservas pendientes o confirmadas: desactivalo en lugar de eliminarlo.',
      );
    }
    await db('cargador').where('id', id).delete();
    res.status(204).end();
  });

  // Moderación (P2): activar o desactivar cualquier cargador.
  router.patch('/admin/cargadores/:id', conSesion, requerirRol('admin'), async (req, res) => {
    const id = idDe(req);
    const { estado } = z
      .object({ estado: z.enum(['activo', 'inactivo']) })
      .strict()
      .parse(req.body);
    const n = await db('cargador').where('id', id).update({ estado });
    if (n === 0) throw new AppError(404, 'NO_ENCONTRADO', 'El cargador no existe.');
    await responderCargador(id, 200, res);
  });

  return router;
}
