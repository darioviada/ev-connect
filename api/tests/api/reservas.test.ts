// Reservas (HU-010 y D-020): solapes 409, horario del cargador, pasado, pendiente/aceptar/rechazar, cancelar.
// Reloj de la app: martes 27/10/2026 10:00. Las reservas de prueba usan fechas posteriores a la ocupación
// sintética del seed (que cubre del 27/10 al 2/11).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CargadorSeed } from '../../seeds/generar.js';
import {
  claveDueno,
  cliente,
  prepararContextoApi,
  tokenSeed,
  type ContextoApi,
} from './contexto.js';

let ctx: ContextoApi;
let publico24: CargadorSeed;
let privado: CargadorSeed; // con franja el martes
let franjaMartes: { inicio: string; fin: string };
let inactivo: CargadorSeed;

beforeAll(async () => {
  ctx = await prepararContextoApi();
  const centricos = ['centro', 'nueva-cordoba', 'guemes'];
  const activos = ctx.datos.cargadores.filter(
    (c) => c.estado === 'activo' && !centricos.includes(c.zona.clave),
  );
  publico24 = activos.find((c) => c.tipo === 'publico' && c.franjas.length === 0)!;
  privado = activos.find((c) => c.tipo === 'privado' && c.franjas.some((f) => f.dia === 'martes'))!;
  franjaMartes = privado.franjas.find((f) => f.dia === 'martes')!;
  inactivo = ctx.datos.cargadores.find((c) => c.estado === 'inactivo')!;
});
afterAll(async () => {
  await ctx?.db.destroy();
});

const usuario = () => cliente(ctx.app, tokenSeed('usuario'));
const admin = () => cliente(ctx.app, tokenSeed('admin'));
const reserva = (c: CargadorSeed, fecha: string, horaInicio: string, horaFin: string) => ({
  cargadorId: c.id,
  fecha,
  horaInicio,
  horaFin,
});
const masMinutos = (hora: string, min: number) => {
  const [h, m] = hora.split(':').map(Number) as [number, number];
  const t = h * 60 + m + min;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

describe('crear reservas', () => {
  it('en un cargador público queda confirmada', async () => {
    const res = await usuario().post(
      '/reservas',
      reserva(publico24, '2026-11-10', '09:00', '10:00'),
    );
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      estado: 'confirmada',
      fecha: '2026-11-10',
      horaInicio: '09:00',
      horaFin: '10:00',
      cargador: { id: publico24.id, tipo: 'publico' },
      puedeCancelar: true,
    });
  });

  it('un horario solapado → 409 RESERVA_SOLAPADA (también con otra cuenta)', async () => {
    expect(
      (await usuario().post('/reservas', reserva(publico24, '2026-11-11', '09:00', '10:00')))
        .status,
    ).toBe(201);
    const solapada = await admin().post(
      '/reservas',
      reserva(publico24, '2026-11-11', '09:30', '10:30'),
    );
    expect(solapada.status).toBe(409);
    expect(solapada.body.error.code).toBe('RESERVA_SOLAPADA');
    // contigua: permitida
    expect(
      (await admin().post('/reservas', reserva(publico24, '2026-11-11', '10:00', '11:00'))).status,
    ).toBe(201);
  });

  it('en un cargador privado queda pendiente hasta que el dueño responda', async () => {
    const inicio = franjaMartes.inicio;
    const res = await usuario().post(
      '/reservas',
      reserva(privado, '2026-11-10', inicio, masMinutos(inicio, 60)),
    );
    expect(res.status).toBe(201);
    expect(res.body.estado).toBe('pendiente');
  });

  it('fuera del horario del cargador → 400 FUERA_DE_HORARIO', async () => {
    // El día que no tiene franja (o justo antes de la apertura del martes)
    const antes = masMinutos(franjaMartes.inicio, -60);
    const res = await usuario().post(
      '/reservas',
      reserva(privado, '2026-11-17', antes, franjaMartes.inicio),
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('FUERA_DE_HORARIO');
    expect(res.body.error.details.disponibilidad.length).toBeGreaterThan(0);
  });

  it.each([
    ['en el pasado', '2026-10-27', '09:00', '09:30', 'RESERVA_EN_EL_PASADO'],
    ['ya empezada (hoy 10:00)', '2026-10-27', '10:00', '11:00', 'RESERVA_EN_EL_PASADO'],
    [
      'con más de 60 días de anticipación',
      '2027-03-01',
      '09:00',
      '10:00',
      'RESERVA_MUY_ANTICIPADA',
    ],
    ['de menos de 15 minutos', '2026-11-12', '09:00', '09:10', 'DURACION_INVALIDA'],
  ])('%s → 400 %s', async (_caso, fecha, inicio, fin, codigo) => {
    const res = await usuario().post('/reservas', reserva(publico24, fecha, inicio, fin));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(codigo);
  });

  it.each([
    ['fin antes del inicio', { fecha: '2026-11-12', horaInicio: '23:00', horaFin: '01:00' }],
    ['fecha inexistente', { fecha: '2026-02-30', horaInicio: '09:00', horaFin: '10:00' }],
    ['hora mal escrita', { fecha: '2026-11-12', horaInicio: '9', horaFin: '10:00' }],
  ])('%s → 400 VALIDACION', async (_caso, datos) => {
    const res = await usuario().post('/reservas', { cargadorId: publico24.id, ...datos });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDACION');
  });

  it('cargador inactivo → 409; inexistente → 404; propio → 400', async () => {
    const r1 = await usuario().post('/reservas', reserva(inactivo, '2026-11-12', '09:00', '10:00'));
    expect(r1.status).toBe(409);
    expect(r1.body.error.code).toBe('CARGADOR_INACTIVO');

    const r2 = await usuario().post('/reservas', {
      ...reserva(publico24, '2026-11-12', '09:00', '10:00'),
      cargadorId: crypto.randomUUID(),
    });
    expect(r2.status).toBe(404);

    const dueno = cliente(ctx.app, tokenSeed(claveDueno(ctx.datos, privado)));
    const r3 = await dueno.post(
      '/reservas',
      reserva(privado, '2026-11-10', franjaMartes.inicio, masMinutos(franjaMartes.inicio, 30)),
    );
    expect(r3.status).toBe(400);
    expect(r3.body.error.code).toBe('RESERVA_PROPIA');
  });
});

describe('mis reservas y cancelación', () => {
  it('lista las reservas propias, con filtro por estado', async () => {
    const res = await usuario().get('/mis-reservas?limit=100');
    expect(res.status).toBe(200);
    expect(res.body.paginacion.total).toBeGreaterThanOrEqual(3); // las 3 del seed
    const estados = res.body.items.map((r: { estado: string }) => r.estado);
    expect(estados).toEqual(expect.arrayContaining(['confirmada', 'pendiente', 'cancelada']));
    const canceladas = await usuario().get('/mis-reservas?estado=cancelada');
    expect(canceladas.body.items.every((r: { estado: string }) => r.estado === 'cancelada')).toBe(
      true,
    );
  });

  it('solo quien reservó puede cancelar; cancelar dos veces → 409', async () => {
    const creada = await usuario().post(
      '/reservas',
      reserva(publico24, '2026-11-13', '15:00', '16:00'),
    );
    const id = creada.body.id;

    const ajeno = await cliente(ctx.app, tokenSeed('anfitrion-01')).patch(
      `/reservas/${id}/cancelar`,
    );
    expect(ajeno.status).toBe(403);

    const ok = await usuario().patch(`/reservas/${id}/cancelar`);
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ estado: 'cancelada', puedeCancelar: false });

    const otraVez = await usuario().patch(`/reservas/${id}/cancelar`);
    expect(otraVez.status).toBe(409);
    expect(otraVez.body.error.code).toBe('RESERVA_YA_CANCELADA');

    // El horario cancelado se puede volver a reservar
    expect(
      (await admin().post('/reservas', reserva(publico24, '2026-11-13', '15:00', '16:00'))).status,
    ).toBe(201);
  });

  it('no se cancela una reserva que ya empezó', async () => {
    // La reserva cancelada del seed es de hace 3 días; usamos una confirmada pasada creada a mano.
    const [{ id }] = await ctx
      .db('reserva')
      .insert({
        usuario_id: (await ctx.db('usuario').where('email', 'usuario@demo.local').first('id')).id,
        cargador_id: publico24.id,
        fecha: '2026-10-20',
        hora_inicio: '09:00',
        hora_fin: '10:00',
        estado: 'confirmada',
      })
      .returning('id');
    const res = await usuario().patch(`/reservas/${id}/cancelar`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('RESERVA_PASADA');
  });
});

describe('aceptar y rechazar (dueño del cargador)', () => {
  async function pendienteNueva(fecha: string) {
    const inicio = masMinutos(franjaMartes.inicio, 60);
    const res = await usuario().post(
      '/reservas',
      reserva(privado, fecha, inicio, masMinutos(inicio, 30)),
    );
    expect(res.body.estado).toBe('pendiente');
    return res.body.id as string;
  }
  const dueno = () => cliente(ctx.app, tokenSeed(claveDueno(ctx.datos, privado)));

  it('el dueño ve las reservas recibidas y acepta una pendiente', async () => {
    const id = await pendienteNueva('2026-11-17');
    const recibidas = await dueno().get('/mis-cargadores/reservas?estado=pendiente');
    expect(recibidas.status).toBe(200);
    const item = recibidas.body.items.find((r: { id: string }) => r.id === id);
    expect(item.reservadaPor).toBe('Usuario Demo');

    const res = await dueno().patch(`/reservas/${id}/aceptar`);
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('confirmada');

    const otraVez = await dueno().patch(`/reservas/${id}/aceptar`);
    expect(otraVez.status).toBe(409);
    expect(otraVez.body.error.code).toBe('RESERVA_NO_PENDIENTE');
  });

  it('rechazar libera el horario; quien reservó no puede aceptarse a sí mismo', async () => {
    const id = await pendienteNueva('2026-11-24');
    expect((await usuario().patch(`/reservas/${id}/aceptar`)).status).toBe(403);
    const res = await dueno().patch(`/reservas/${id}/rechazar`);
    expect(res.body.estado).toBe('cancelada');
  });

  it('un admin también puede responder', async () => {
    const id = await pendienteNueva('2026-12-01');
    expect((await admin().patch(`/reservas/${id}/aceptar`)).body.estado).toBe('confirmada');
  });

  it('mis cargadores informa la cantidad de pendientes', async () => {
    await pendienteNueva('2026-12-08');
    const res = await dueno().get('/mis-cargadores');
    const mio = res.body.items.find((c: { id: string }) => c.id === privado.id);
    expect(mio.reservasPendientes).toBeGreaterThanOrEqual(1);
  });
});
