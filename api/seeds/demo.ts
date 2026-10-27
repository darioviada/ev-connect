// DATOS SINTÉTICOS DE DEMOSTRACIÓN — escritura en la base.
// Idempotente: cada dato tiene un id estable, así que volver a correrlo actualiza en lugar de duplicar
// y no toca lo que hayan creado los usuarios. Con `reset` vacía todas las tablas antes de sembrar.
// En modo Cognito no crea los usuarios de demostración ni sus datos (no tienen contraseña en Cognito).
import bcrypt from 'bcryptjs';
import type { Knex } from 'knex';
import { generarDatos } from './generar.js';

export interface OpcionesSembrar {
  reset: boolean;
  modoAuth: 'local' | 'cognito';
  /** Fecha de referencia 'YYYY-MM-DD' para las reservas. */
  hoy: string;
}

export interface ResumenSeed {
  modelos: number;
  usuarios: number;
  cargadores: { publicos: number; privados: number; inactivos: number };
  franjas: number;
  reservas: number;
  usuariosDemo: boolean;
}

const TABLAS_DE_DATOS = [
  'usuario',
  'vehiculo_modelo',
  'vehiculo_usuario',
  'cargador',
  'disponibilidad',
  'reserva',
  'favorito',
  'ruta_guardada',
  'cache_ruta',
  'cache_trazado',
];

export async function sembrar(db: Knex, opciones: OpcionesSembrar): Promise<ResumenSeed> {
  const incluirUsuariosDemo = opciones.modoAuth === 'local';
  const datos = generarDatos({ hoy: opciones.hoy, incluirUsuariosDemo });
  const hayCredenciales = incluirUsuariosDemo && (await db.schema.hasTable('dev_credencial'));
  if (incluirUsuariosDemo && !hayCredenciales) {
    throw new Error('Falta la tabla dev_credencial: corré primero `npm run db:migrate`.');
  }

  // Los hashes se calculan fuera de la transacción (bcrypt es lento a propósito).
  const credenciales = await Promise.all(
    datos.usuarios
      .filter((u) => u.credencial)
      .map(async (u) => ({
        usuario_id: u.id,
        password_hash: await bcrypt.hash(u.credencial!.password, 10),
        rol: u.credencial!.rol,
      })),
  );

  await db.transaction(async (trx) => {
    if (opciones.reset) {
      // CASCADE incluye dev_credencial (referencia a usuario).
      await trx.raw(`TRUNCATE ${TABLAS_DE_DATOS.join(', ')} CASCADE`);
    }

    await trx('vehiculo_modelo')
      .insert(
        datos.modelos.map((m) => ({
          id: m.id,
          marca: m.marca,
          modelo: m.modelo,
          capacidad_bateria: m.capacidadBateria,
          consumo: m.consumo,
          tipo_conector: m.tipoConector,
          potencia_max_ac: m.potenciaMaxAc,
          potencia_max_dc: m.potenciaMaxDc,
        })),
      )
      .onConflict('id')
      .merge();

    await trx('usuario')
      .insert(
        datos.usuarios.map((u) => ({
          id: u.id,
          cognito_sub: u.cognitoSub,
          nombre: u.nombre,
          email: u.email,
          activo: true,
        })),
      )
      .onConflict('id')
      .merge();

    if (credenciales.length > 0) {
      await trx('dev_credencial').insert(credenciales).onConflict('usuario_id').merge();
    }

    await trx('cargador')
      .insert(
        datos.cargadores.map((c) => ({
          id: c.id,
          usuario_id: c.usuarioId,
          nombre: c.nombre,
          direccion: c.direccion,
          tipo: c.tipo,
          ubicacion: trx.raw('ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography', [c.lng, c.lat]),
          tipo_conector: c.tipoConector,
          potencia: c.potencia,
          precio_kwh: c.precioKwh,
          estado: c.estado,
        })),
      )
      .onConflict('id')
      .merge();

    // Franjas: se reemplazan las de los cargadores del seed.
    const idsCargadores = datos.cargadores.map((c) => c.id);
    await trx('disponibilidad').whereIn('cargador_id', idsCargadores).delete();
    const filasFranjas = datos.cargadores.flatMap((c) =>
      c.franjas.map((f) => ({
        cargador_id: c.id,
        dia_semana: f.dia,
        hora_inicio: f.inicio,
        hora_fin: f.fin,
      })),
    );
    if (filasFranjas.length > 0) await trx('disponibilidad').insert(filasFranjas);

    if (datos.vehiculos.length > 0) {
      await trx('vehiculo_usuario')
        .insert(
          datos.vehiculos.map((v) => ({
            id: v.id,
            usuario_id: v.usuarioId,
            modelo_id: v.modeloId,
          })),
        )
        .onConflict('id')
        .merge();
    }

    // Reservas: las del seed se regeneran (sus fechas son relativas a hoy). Si alguna choca con una
    // reserva creada por un usuario real, se omite (ON CONFLICT DO NOTHING cubre la restricción EXCLUDE).
    await trx('reserva')
      .whereIn(
        'id',
        datos.reservas.map((r) => r.id),
      )
      .delete();
    for (const r of datos.reservas) {
      await trx('reserva')
        .insert({
          id: r.id,
          usuario_id: r.usuarioId,
          cargador_id: r.cargadorId,
          fecha: r.fecha,
          hora_inicio: r.horaInicio,
          hora_fin: r.horaFin,
          estado: r.estado,
        })
        .onConflict()
        .ignore();
    }

    if (datos.favoritos.length > 0) {
      await trx('favorito')
        .insert(
          datos.favoritos.map((f) => ({
            id: f.id,
            usuario_id: f.usuarioId,
            cargador_id: f.cargadorId,
          })),
        )
        .onConflict(['usuario_id', 'cargador_id'])
        .ignore();
    }

    if (datos.rutas.length > 0) {
      await trx('ruta_guardada')
        .insert(
          datos.rutas.map((r) => ({
            id: r.id,
            usuario_id: r.usuarioId,
            nombre: r.nombre,
            origen_lat: r.origen.lat,
            origen_lng: r.origen.lng,
            destino_lat: r.destino.lat,
            destino_lng: r.destino.lng,
          })),
        )
        .onConflict('id')
        .merge();
    }
  });

  const contar = async (tabla: string, filtro: Record<string, string> = {}) => {
    const fila = await db(tabla).where(filtro).count<{ n: string }[]>({ n: '*' }).first();
    return Number(fila?.n ?? 0);
  };
  return {
    modelos: await contar('vehiculo_modelo'),
    usuarios: await contar('usuario'),
    cargadores: {
      publicos: await contar('cargador', { tipo: 'publico' }),
      privados: await contar('cargador', { tipo: 'privado' }),
      inactivos: await contar('cargador', { estado: 'inactivo' }),
    },
    franjas: await contar('disponibilidad'),
    reservas: await contar('reserva'),
    usuariosDemo: incluirUsuariosDemo,
  };
}
