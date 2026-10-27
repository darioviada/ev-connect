// HU-010 — Reservas. Reglas (SPEC §5 y D-020):
// - No se solapan en el mismo cargador (restricción EXCLUDE de la base → 409 RESERVA_SOLAPADA).
// - Deben caer dentro del horario de disponibilidad del cargador y no pueden estar en el pasado.
// - En un cargador privado nacen `pendiente` hasta que el dueño las acepte; en uno público, `confirmada`.
// - Las pendientes también bloquean el horario.
import { Router } from 'express';
import type { Knex } from 'knex';
import { z } from 'zod';
import { proximoInicioEnHorario } from '../../engine/disponibilidad.js';
import { minutosLocales } from '../../engine/tiempo.js';
import { codigoPg, PG } from '../../db/errores.js';
import { AppError } from '../../errors.js';
import { autenticar, type UsuarioAutenticado } from '../../middleware/auth.js';
import { aFranjaMotor, franjasPorCargador } from '../cargadores/cargadores.repo.js';
import type { DependenciasApi } from '../comun/dependencias.js';
import {
  contarTotal,
  esquemaFecha,
  esquemaHora,
  esquemaPaginacion,
  hhmm,
  idDe,
  paginado,
} from '../comun/esquemas.js';
import { momentoLocal } from '../comun/reloj.js';

const DURACION_MINIMA_MIN = 15;
const DURACION_MAXIMA_MIN = 12 * 60;
const ANTICIPACION_MAXIMA_DIAS = 60;

const esquemaReserva = z
  .object({
    cargadorId: z.uuid(),
    fecha: esquemaFecha,
    horaInicio: esquemaHora,
    horaFin: esquemaHora,
  })
  .strict()
  .refine((r) => r.horaFin > r.horaInicio, {
    message:
      'La hora de fin debe ser posterior a la de inicio (las reservas no cruzan medianoche).',
    path: ['horaFin'],
  });

const ESTADOS = ['pendiente', 'confirmada', 'cancelada'] as const;

interface FilaReserva {
  id: string;
  usuario_id: string;
  cargador_id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: (typeof ESTADOS)[number];
  cargador_nombre: string;
  cargador_direccion: string | null;
  cargador_tipo: 'publico' | 'privado';
  cargador_dueno: string | null;
  usuario_nombre?: string;
}

function consultaReservas(db: Knex) {
  return db('reserva as r')
    .join('cargador as c', 'c.id', 'r.cargador_id')
    .select(
      'r.id',
      'r.usuario_id',
      'r.cargador_id',
      'r.fecha',
      'r.hora_inicio',
      'r.hora_fin',
      'r.estado',
      'c.nombre as cargador_nombre',
      'c.direccion as cargador_direccion',
      'c.tipo as cargador_tipo',
      'c.usuario_id as cargador_dueno',
    );
}

export function reservasRouter(deps: DependenciasApi): Router {
  const { db, reloj } = deps;
  const router = Router();
  const conSesion = autenticar(deps, { obligatorio: true });

  const yaEmpezo = (r: Pick<FilaReserva, 'fecha' | 'hora_inicio'>) =>
    minutosLocales(r.fecha, r.hora_inicio) <= momentoLocal(reloj).minutos;

  const aJson = (r: FilaReserva, usuario: UsuarioAutenticado) => ({
    id: r.id,
    cargador: {
      id: r.cargador_id,
      nombre: r.cargador_nombre,
      direccion: r.cargador_direccion,
      tipo: r.cargador_tipo,
    },
    fecha: r.fecha,
    horaInicio: hhmm(r.hora_inicio),
    horaFin: hhmm(r.hora_fin),
    estado: r.estado,
    ...(r.usuario_nombre !== undefined ? { reservadaPor: r.usuario_nombre } : {}),
    puedeCancelar: r.usuario_id === usuario.id && r.estado !== 'cancelada' && !yaEmpezo(r),
  });

  async function buscar(id: string): Promise<FilaReserva> {
    const r = await consultaReservas(db).where('r.id', id).first();
    if (!r) throw new AppError(404, 'NO_ENCONTRADO', 'La reserva no existe.');
    return r;
  }

  router.post('/reservas', conSesion, async (req, res) => {
    const datos = esquemaReserva.parse(req.body);
    const usuario = req.usuario!;

    const cargador = await db('cargador')
      .where('id', datos.cargadorId)
      .first('id', 'tipo', 'estado', 'usuario_id');
    if (!cargador) throw new AppError(404, 'NO_ENCONTRADO', 'El cargador no existe.');
    if (cargador.estado !== 'activo') {
      throw new AppError(409, 'CARGADOR_INACTIVO', 'El cargador no está disponible para reservas.');
    }
    if (cargador.usuario_id === usuario.id) {
      throw new AppError(400, 'RESERVA_PROPIA', 'No podés reservar tu propio cargador.');
    }

    const inicio = minutosLocales(datos.fecha, datos.horaInicio);
    const fin = minutosLocales(datos.fecha, datos.horaFin);
    const duracion = fin - inicio;
    const ahora = momentoLocal(reloj).minutos;
    if (inicio <= ahora) {
      throw new AppError(400, 'RESERVA_EN_EL_PASADO', 'La reserva tiene que empezar en el futuro.');
    }
    if (inicio - ahora > ANTICIPACION_MAXIMA_DIAS * 24 * 60) {
      throw new AppError(
        400,
        'RESERVA_MUY_ANTICIPADA',
        `Se puede reservar con hasta ${ANTICIPACION_MAXIMA_DIAS} días de anticipación.`,
      );
    }
    if (duracion < DURACION_MINIMA_MIN || duracion > DURACION_MAXIMA_MIN) {
      throw new AppError(
        400,
        'DURACION_INVALIDA',
        `La reserva debe durar entre ${DURACION_MINIMA_MIN} minutos y ${DURACION_MAXIMA_MIN / 60} horas.`,
      );
    }

    const franjas = (await franjasPorCargador(db, [cargador.id]))
      .get(cargador.id)!
      .map(aFranjaMotor);
    if (proximoInicioEnHorario(inicio, duracion, franjas, inicio) !== inicio) {
      throw new AppError(
        400,
        'FUERA_DE_HORARIO',
        'El horario elegido no está dentro de la disponibilidad del cargador.',
        { disponibilidad: franjas },
      );
    }

    let id: string;
    try {
      [{ id }] = await db('reserva')
        .insert({
          usuario_id: usuario.id,
          cargador_id: cargador.id,
          fecha: datos.fecha,
          hora_inicio: datos.horaInicio,
          hora_fin: datos.horaFin,
          estado: cargador.tipo === 'privado' ? 'pendiente' : 'confirmada',
        })
        .returning('id');
    } catch (error) {
      if (codigoPg(error) === PG.VIOLACION_EXCLUSION) {
        throw new AppError(
          409,
          'RESERVA_SOLAPADA',
          'Ese horario ya está reservado en este cargador. Probá con otro horario.',
        );
      }
      throw error;
    }
    res.status(201).json(aJson(await buscar(id), usuario));
  });

  router.get('/mis-reservas', conSesion, async (req, res) => {
    const { estado, ...pag } = esquemaPaginacion
      .extend({ estado: z.enum(ESTADOS).optional() })
      .parse(req.query);
    const query = consultaReservas(db).where('r.usuario_id', req.usuario!.id);
    if (estado) query.where('r.estado', estado);
    const total = await contarTotal(query);
    const filas = await query
      .orderBy([
        { column: 'r.fecha', order: 'desc' },
        { column: 'r.hora_inicio', order: 'desc' },
      ])
      .limit(pag.limit)
      .offset(pag.offset);
    res.json(
      paginado(
        filas.map((r: FilaReserva) => aJson(r, req.usuario!)),
        total,
        pag,
      ),
    );
  });

  // Reservas recibidas en los cargadores propios (para aceptar o rechazar las pendientes).
  router.get('/mis-cargadores/reservas', conSesion, async (req, res) => {
    const { estado, ...pag } = esquemaPaginacion
      .extend({ estado: z.enum(ESTADOS).optional() })
      .parse(req.query);
    const query = consultaReservas(db)
      .join('usuario as u', 'u.id', 'r.usuario_id')
      .select('u.nombre as usuario_nombre')
      .where('c.usuario_id', req.usuario!.id);
    if (estado) query.where('r.estado', estado);
    const total = await contarTotal(query);
    const filas = await query
      .orderBy(['r.fecha', 'r.hora_inicio'])
      .limit(pag.limit)
      .offset(pag.offset);
    res.json(
      paginado(
        filas.map((r: FilaReserva) => aJson(r, req.usuario!)),
        total,
        pag,
      ),
    );
  });

  router.patch('/reservas/:id/cancelar', conSesion, async (req, res) => {
    const r = await buscar(idDe(req));
    const usuario = req.usuario!;
    if (r.usuario_id !== usuario.id && usuario.rol !== 'admin') {
      throw new AppError(403, 'PERMISO_DENEGADO', 'Solo quien hizo la reserva puede cancelarla.');
    }
    if (r.estado === 'cancelada') {
      throw new AppError(409, 'RESERVA_YA_CANCELADA', 'La reserva ya estaba cancelada.');
    }
    if (yaEmpezo(r)) {
      throw new AppError(409, 'RESERVA_PASADA', 'No se puede cancelar una reserva que ya empezó.');
    }
    await db('reserva').where('id', r.id).update({ estado: 'cancelada' });
    res.json(aJson(await buscar(r.id), usuario));
  });

  // El dueño del cargador (o un admin) decide sobre las reservas pendientes.
  for (const [accion, nuevoEstado] of [
    ['aceptar', 'confirmada'],
    ['rechazar', 'cancelada'],
  ] as const) {
    router.patch(`/reservas/:id/${accion}`, conSesion, async (req, res) => {
      const r = await buscar(idDe(req));
      const usuario = req.usuario!;
      if (r.cargador_dueno !== usuario.id && usuario.rol !== 'admin') {
        throw new AppError(
          403,
          'PERMISO_DENEGADO',
          'Solo el dueño del cargador puede responder la reserva.',
        );
      }
      if (r.estado !== 'pendiente') {
        throw new AppError(
          409,
          'RESERVA_NO_PENDIENTE',
          `La reserva está ${r.estado}: no se puede ${accion}.`,
        );
      }
      if (accion === 'aceptar' && yaEmpezo(r)) {
        throw new AppError(409, 'RESERVA_PASADA', 'La reserva ya empezó: no se puede aceptar.');
      }
      await db('reserva').where('id', r.id).update({ estado: nuevoEstado });
      res.json(aJson(await buscar(r.id), usuario));
    });
  }

  return router;
}
