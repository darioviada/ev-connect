// Restricciones del esquema (SPEC §5) contra PostgreSQL + PostGIS reales.
import { randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { codigoDeError, enTransaccion, PG, prepararBaseDePrueba } from './baseDePrueba.js';

let db: Knex;
beforeAll(async () => {
  db = await prepararBaseDePrueba();
});
afterAll(async () => {
  await db?.destroy();
});

async function crearUsuario(trx: Knex.Transaction): Promise<string> {
  const id = randomUUID();
  await trx('usuario').insert({ id, cognito_sub: id, nombre: 'Prueba', email: `${id}@test.local` });
  return id;
}

async function crearCargador(
  trx: Knex.Transaction,
  datos: {
    tipo?: 'publico' | 'privado';
    usuarioId?: string | null;
    lng?: number;
    lat?: number;
  } = {},
): Promise<string> {
  const id = randomUUID();
  await trx('cargador').insert({
    id,
    usuario_id: datos.usuarioId ?? null,
    nombre: 'Cargador de prueba',
    tipo: datos.tipo ?? 'publico',
    ubicacion: trx.raw('ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography', [
      datos.lng ?? -64.1888,
      datos.lat ?? -31.4201,
    ]),
    tipo_conector: 'TIPO_2',
    potencia: 22,
    precio_kwh: 400,
  });
  return id;
}

const reserva = (
  usuarioId: string,
  cargadorId: string,
  inicio: string,
  fin: string,
  estado = 'confirmada',
) => ({
  usuario_id: usuarioId,
  cargador_id: cargadorId,
  fecha: '2030-01-15',
  hora_inicio: inicio,
  hora_fin: fin,
  estado,
});

describe('extensiones', () => {
  it('postgis y btree_gist están instaladas', async () => {
    const { rows } = await db.raw(
      "SELECT extname FROM pg_extension WHERE extname IN ('postgis','btree_gist') ORDER BY extname",
    );
    expect(rows.map((r: { extname: string }) => r.extname)).toEqual(['btree_gist', 'postgis']);
  });
});

describe('reservas: restricción de solapamiento', () => {
  it('rechaza dos reservas solapadas en el mismo cargador', () =>
    enTransaccion(db, async (trx) => {
      const u = await crearUsuario(trx);
      const c = await crearCargador(trx);
      await trx('reserva').insert(reserva(u, c, '10:00', '11:00'));
      const codigo = await codigoDeError(trx, (t) =>
        t('reserva').insert(reserva(u, c, '10:30', '11:30')),
      );
      expect(codigo).toBe(PG.VIOLACION_EXCLUSION);
    }));

  it('permite reservas contiguas (el fin de una es el inicio de la otra)', () =>
    enTransaccion(db, async (trx) => {
      const u = await crearUsuario(trx);
      const c = await crearCargador(trx);
      await trx('reserva').insert(reserva(u, c, '10:00', '11:00'));
      expect(
        await codigoDeError(trx, (t) => t('reserva').insert(reserva(u, c, '11:00', '12:00'))),
      ).toBeNull();
    }));

  it('permite reutilizar el horario de una reserva cancelada', () =>
    enTransaccion(db, async (trx) => {
      const u = await crearUsuario(trx);
      const c = await crearCargador(trx);
      await trx('reserva').insert(reserva(u, c, '10:00', '11:00', 'cancelada'));
      expect(
        await codigoDeError(trx, (t) => t('reserva').insert(reserva(u, c, '10:00', '11:00'))),
      ).toBeNull();
    }));

  it('una reserva pendiente también bloquea el horario', () =>
    enTransaccion(db, async (trx) => {
      const u = await crearUsuario(trx);
      const c = await crearCargador(trx);
      await trx('reserva').insert(reserva(u, c, '10:00', '11:00', 'pendiente'));
      expect(
        await codigoDeError(trx, (t) => t('reserva').insert(reserva(u, c, '10:15', '10:45'))),
      ).toBe(PG.VIOLACION_EXCLUSION);
    }));

  it('permite el mismo horario en cargadores distintos', () =>
    enTransaccion(db, async (trx) => {
      const u = await crearUsuario(trx);
      const c1 = await crearCargador(trx);
      const c2 = await crearCargador(trx);
      await trx('reserva').insert(reserva(u, c1, '10:00', '11:00'));
      expect(
        await codigoDeError(trx, (t) => t('reserva').insert(reserva(u, c2, '10:00', '11:00'))),
      ).toBeNull();
    }));

  it('rechaza una reserva cuyo fin no es posterior al inicio (no cruza medianoche)', () =>
    enTransaccion(db, async (trx) => {
      const u = await crearUsuario(trx);
      const c = await crearCargador(trx);
      // fin < inicio: lo rechaza primero la columna generada (rango inválido, clase 22000).
      expect(
        await codigoDeError(trx, (t) => t('reserva').insert(reserva(u, c, '23:00', '01:00'))),
      ).toBe(PG.RANGO_INVALIDO);
      // fin = inicio: rango vacío válido, lo rechaza el CHECK.
      expect(
        await codigoDeError(trx, (t) => t('reserva').insert(reserva(u, c, '10:00', '10:00'))),
      ).toBe(PG.VIOLACION_CHECK);
    }));

  it('calcula la columna generada rango', () =>
    enTransaccion(db, async (trx) => {
      const u = await crearUsuario(trx);
      const c = await crearCargador(trx);
      const [fila] = await trx('reserva')
        .insert(reserva(u, c, '10:00', '11:30'))
        .returning('rango');
      expect(fila.rango).toBe('["2030-01-15 10:00:00","2030-01-15 11:30:00")');
    }));
});

describe('cargadores', () => {
  it('rechaza un cargador privado sin dueño', () =>
    enTransaccion(db, async (trx) => {
      expect(
        await codigoDeError(trx, (t) => crearCargador(t, { tipo: 'privado', usuarioId: null })),
      ).toBe(PG.VIOLACION_CHECK);
    }));

  it('acepta un cargador público sin dueño y uno privado con dueño', () =>
    enTransaccion(db, async (trx) => {
      const u = await crearUsuario(trx);
      expect(await codigoDeError(trx, (t) => crearCargador(t, { tipo: 'publico' }))).toBeNull();
      expect(
        await codigoDeError(trx, (t) => crearCargador(t, { tipo: 'privado', usuarioId: u })),
      ).toBeNull();
    }));

  it('rechaza franjas de disponibilidad con fin anterior al inicio', () =>
    enTransaccion(db, async (trx) => {
      const c = await crearCargador(trx);
      const codigo = await codigoDeError(trx, (t) =>
        t('disponibilidad').insert({
          cargador_id: c,
          dia_semana: 'lunes',
          hora_inicio: '20:00',
          hora_fin: '08:00',
        }),
      );
      expect(codigo).toBe(PG.VIOLACION_CHECK);
    }));

  it('las consultas espaciales de radio y corredor (ST_DWithin) devuelven lo esperado', () =>
    enTransaccion(db, async (trx) => {
      // Cerca del centro de Córdoba; a ~22 km del centro pero sobre la línea Córdoba–Carlos Paz; en Rosario.
      const cerca = await crearCargador(trx, { lng: -64.19, lat: -31.42 });
      const corredor = await crearCargador(trx, { lng: -64.42, lat: -31.435 });
      const lejos = await crearCargador(trx, { lng: -60.64, lat: -32.95 });
      const ids = [cerca, corredor, lejos];

      const radio = await trx('cargador')
        .whereIn('id', ids)
        .whereRaw(
          'ST_DWithin(ubicacion, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, ?)',
          [-64.1888, -31.4201, 20_000],
        )
        .pluck('id');
      expect(radio).toEqual([cerca]);

      const enCorredor = await trx('cargador')
        .whereIn('id', ids)
        .whereRaw(
          `ST_DWithin(ubicacion, ST_MakeLine(ST_SetSRID(ST_MakePoint(?, ?), 4326),
                                             ST_SetSRID(ST_MakePoint(?, ?), 4326))::geography, ?)`,
          [-64.1888, -31.4201, -64.4978, -31.4241, 5_000],
        )
        .pluck('id');
      expect(enCorredor.sort()).toEqual([cerca, corredor].sort());
    }));
});

describe('vehículos', () => {
  it('rechaza un vehículo personalizado incompleto', () =>
    enTransaccion(db, async (trx) => {
      const u = await crearUsuario(trx);
      const codigo = await codigoDeError(trx, (t) =>
        t('vehiculo_usuario').insert({
          usuario_id: u,
          marca: 'X',
          modelo: 'Y',
          capacidad_bateria: 40,
        }),
      );
      expect(codigo).toBe(PG.VIOLACION_CHECK);
    }));

  it('la vista vehiculo_usuario_detalle resuelve catálogo y personalizados', () =>
    enTransaccion(db, async (trx) => {
      const u = await crearUsuario(trx);
      const [modelo] = await trx('vehiculo_modelo')
        .insert({
          marca: 'Prueba',
          modelo: randomUUID(),
          capacidad_bateria: 50,
          consumo: 15,
          tipo_conector: 'CCS_COMBO',
          potencia_max_ac: 7.4,
          potencia_max_dc: 100,
        })
        .returning('id');
      const [delCatalogo] = await trx('vehiculo_usuario')
        .insert({ usuario_id: u, modelo_id: modelo.id })
        .returning('id');
      const [propio] = await trx('vehiculo_usuario')
        .insert({
          usuario_id: u,
          marca: 'Casero',
          modelo: 'Uno',
          capacidad_bateria: 30,
          consumo: 14,
          tipo_conector: 'TIPO_2',
          potencia_max_ac: 11,
        })
        .returning('id');

      const filas = await trx('vehiculo_usuario_detalle').where('usuario_id', u);
      const porId = Object.fromEntries(filas.map((f) => [f.id, f]));
      expect(porId[delCatalogo.id]).toMatchObject({
        personalizado: false,
        capacidad_bateria: 50,
        tipo_conector: 'CCS_COMBO',
        potencia_max_dc: 100,
      });
      expect(porId[propio.id]).toMatchObject({
        personalizado: true,
        marca: 'Casero',
        capacidad_bateria: 30,
        potencia_max_dc: null,
      });
    }));

  it('el catálogo no admite marca y modelo repetidos', () =>
    enTransaccion(db, async (trx) => {
      const fila = {
        marca: 'Repetida',
        modelo: 'Modelo',
        capacidad_bateria: 40,
        consumo: 15,
        tipo_conector: 'TIPO_2',
        potencia_max_ac: 7,
      };
      await trx('vehiculo_modelo').insert(fila);
      expect(await codigoDeError(trx, (t) => t('vehiculo_modelo').insert(fila))).toBe(
        PG.VIOLACION_UNICA,
      );
    }));
});

describe('dev_credencial (solo modo local)', () => {
  it('solo admite los roles user y admin', () =>
    enTransaccion(db, async (trx) => {
      const u = await crearUsuario(trx);
      const codigo = await codigoDeError(trx, (t) =>
        t('dev_credencial').insert({ usuario_id: u, password_hash: 'x', rol: 'superadmin' }),
      );
      expect(codigo).toBe(PG.VIOLACION_CHECK);
    }));
});
