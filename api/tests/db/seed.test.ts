// Seed contra la base real: carga completa, idempotencia, --reset y modo Cognito.
// Cada test parte de un estado propio (siembra con reset), así no depende del orden de ejecución.
import bcrypt from 'bcryptjs';
import type { Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sembrar, type OpcionesSembrar } from '../../seeds/demo.js';
import { prepararBaseDePrueba } from './baseDePrueba.js';

const HOY = '2026-10-27';
let db: Knex;

beforeAll(async () => {
  db = await prepararBaseDePrueba();
});
afterAll(async () => {
  // Deja la base de pruebas vacía para los demás tests.
  await db?.raw(
    'TRUNCATE usuario, vehiculo_modelo, cargador, reserva, disponibilidad, vehiculo_usuario, favorito, ruta_guardada, cache_ruta CASCADE',
  );
  await db?.destroy();
});

const sembrarDesdeCero = (modoAuth: OpcionesSembrar['modoAuth'] = 'local') =>
  sembrar(db, { reset: true, modoAuth, hoy: HOY });

const contar = async (tabla: string) =>
  Number((await db(tabla).count<{ n: string }[]>({ n: '*' }).first())?.n ?? 0);

describe('sembrar (modo local)', () => {
  it('carga catálogo, cargadores, franjas, usuarios y reservas', async () => {
    const r = await sembrarDesdeCero();
    expect(r.modelos).toBe(8);
    expect(r.cargadores).toEqual({ publicos: 29, privados: 43, inactivos: 2 });
    expect(r.franjas).toBeGreaterThan(0);
    expect(r.reservas).toBeGreaterThan(0);
    expect(r.usuarios).toBe(27); // 25 dueños ficticios + 2 de demostración
  });

  it('los usuarios de demostración pueden iniciar sesión con las contraseñas documentadas', async () => {
    await sembrarDesdeCero();
    const filas = await db('usuario as u')
      .join('dev_credencial as d', 'd.usuario_id', 'u.id')
      .select('u.email', 'd.password_hash', 'd.rol');
    expect(filas).toHaveLength(2);
    const admin = filas.find((f) => f.email === 'admin@demo.local')!;
    const usuario = filas.find((f) => f.email === 'usuario@demo.local')!;
    expect(admin.rol).toBe('admin');
    expect(usuario.rol).toBe('user');
    expect(await bcrypt.compare('Admin123!', admin.password_hash)).toBe(true);
    expect(await bcrypt.compare('Usuario123!', usuario.password_hash)).toBe(true);
  });

  it('es idempotente: correrlo de nuevo no duplica datos', async () => {
    await sembrarDesdeCero();
    const conteo = async () => ({
      usuarios: await contar('usuario'),
      cargadores: await contar('cargador'),
      franjas: await contar('disponibilidad'),
      reservas: await contar('reserva'),
    });
    const antes = await conteo();
    await sembrar(db, { reset: false, modoAuth: 'local', hoy: HOY });
    expect(await conteo()).toEqual(antes);
  });

  it('sin --reset conserva los datos creados por usuarios; con --reset los borra', async () => {
    await sembrarDesdeCero();
    await db('usuario').insert({
      cognito_sub: 'externo',
      nombre: 'Externo',
      email: 'externo@test.local',
    });
    await sembrar(db, { reset: false, modoAuth: 'local', hoy: HOY });
    expect(await db('usuario').where('email', 'externo@test.local').first()).toBeDefined();

    await sembrarDesdeCero();
    expect(await db('usuario').where('email', 'externo@test.local').first()).toBeUndefined();
  });

  it('los cargadores inactivos no aparecen en una consulta de cargadores activos', async () => {
    await sembrarDesdeCero();
    const activos = await db('cargador')
      .where('estado', 'activo')
      .count<{ n: string }[]>({ n: '*' });
    expect(Number(activos[0]!.n)).toBe(70);
  });
});

describe('sembrar (modo Cognito)', () => {
  it('no crea usuarios de demostración ni credenciales', async () => {
    await sembrarDesdeCero('cognito');
    expect(
      await db('usuario').whereIn('email', ['admin@demo.local', 'usuario@demo.local']).first(),
    ).toBeUndefined();
    expect(await contar('dev_credencial')).toBe(0);
    expect(await contar('cargador')).toBe(72);
  });
});
