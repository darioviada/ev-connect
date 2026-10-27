// HU-002 catálogo (público, solo lectura para usuarios), HU-003 vehículos propios y administración del catálogo (P2).
import { Router } from 'express';
import type { Knex } from 'knex';
import { z } from 'zod';
import { codigoPg, PG } from '../../db/errores.js';
import { AppError } from '../../errors.js';
import { autenticar, requerirRol } from '../../middleware/auth.js';
import type { DependenciasApi } from '../comun/dependencias.js';
import {
  CONECTORES,
  contarTotal,
  esquemaPaginacion,
  idDe,
  paginado,
  patronContiene,
} from '../comun/esquemas.js';

// --- Representación JSON -------------------------------------------------------------------

interface FilaVehiculo {
  id: string;
  marca: string;
  modelo: string;
  capacidad_bateria: number;
  consumo: number;
  tipo_conector: string;
  potencia_max_ac: number;
  potencia_max_dc: number | null;
}

export const aModeloJson = (f: FilaVehiculo) => ({
  id: f.id,
  marca: f.marca,
  modelo: f.modelo,
  capacidadBateriaKwh: f.capacidad_bateria,
  consumoKwhPor100km: f.consumo,
  tipoConector: f.tipo_conector,
  potenciaMaxAcKw: f.potencia_max_ac,
  potenciaMaxDcKw: f.potencia_max_dc,
});

const aVehiculoUsuarioJson = (
  f: FilaVehiculo & { modelo_id: string | null; personalizado: boolean },
) => ({
  ...aModeloJson(f),
  modeloId: f.modelo_id,
  personalizado: f.personalizado,
});

// --- Validación -----------------------------------------------------------------------------

export const esquemaDatosVehiculo = z
  .object({
    marca: z.string().trim().min(1).max(60),
    modelo: z.string().trim().min(1).max(80),
    capacidadBateriaKwh: z.number().positive().max(250),
    consumoKwhPor100km: z.number().positive().max(60),
    tipoConector: z.enum(CONECTORES),
    potenciaMaxAcKw: z.number().positive().max(50),
    potenciaMaxDcKw: z.number().positive().max(400).nullable(),
  })
  .refine((v) => v.tipoConector === 'TIPO_2' || v.potenciaMaxDcKw !== null, {
    message: 'Un vehículo con conector CCS o CHAdeMO debe indicar su potencia máxima en DC.',
    path: ['potenciaMaxDcKw'],
  });

const esquemaVehiculoUsuario = z.union([
  z.object({ modeloId: z.uuid() }).strict(),
  z.object({ personalizado: esquemaDatosVehiculo }).strict(),
]);

const aColumnas = (v: z.infer<typeof esquemaDatosVehiculo>) => ({
  marca: v.marca,
  modelo: v.modelo,
  capacidad_bateria: v.capacidadBateriaKwh,
  consumo: v.consumoKwhPor100km,
  tipo_conector: v.tipoConector,
  potencia_max_ac: v.potenciaMaxAcKw,
  potencia_max_dc: v.potenciaMaxDcKw,
});

const SIN_DATOS_PROPIOS = {
  marca: null,
  modelo: null,
  capacidad_bateria: null,
  consumo: null,
  tipo_conector: null,
  potencia_max_ac: null,
  potencia_max_dc: null,
};

async function columnasVehiculoUsuario(db: Knex, cuerpo: z.infer<typeof esquemaVehiculoUsuario>) {
  if ('modeloId' in cuerpo) {
    const existe = await db('vehiculo_modelo').where('id', cuerpo.modeloId).first('id');
    if (!existe) {
      throw new AppError(
        404,
        'MODELO_NO_ENCONTRADO',
        'El modelo indicado no existe en el catálogo.',
      );
    }
    return { modelo_id: cuerpo.modeloId, ...SIN_DATOS_PROPIOS };
  }
  return { modelo_id: null, ...aColumnas(cuerpo.personalizado) };
}

const noEncontrado = () =>
  new AppError(404, 'NO_ENCONTRADO', 'El vehículo no existe o no es tuyo.');

// --- Rutas ----------------------------------------------------------------------------------

export function vehiculosRouter(deps: DependenciasApi): Router {
  const { db } = deps;
  const router = Router();
  const conSesion = autenticar(deps, { obligatorio: true });

  // Catálogo público
  router.get('/vehiculos-modelo', async (req, res) => {
    const { q, ...pag } = esquemaPaginacion
      .extend({ q: z.string().trim().max(60).optional() })
      .parse(req.query);
    const query = db('vehiculo_modelo');
    if (q) {
      query.where((w) =>
        w.whereILike('marca', patronContiene(q)).orWhereILike('modelo', patronContiene(q)),
      );
    }
    const total = await contarTotal(query);
    const filas = await query.orderBy(['marca', 'modelo']).limit(pag.limit).offset(pag.offset);
    res.json(paginado(filas.map(aModeloJson), total, pag));
  });

  // Vehículos propios
  router.get('/mis-vehiculos', conSesion, async (req, res) => {
    const filas = await db('vehiculo_usuario_detalle')
      .where('usuario_id', req.usuario!.id)
      .orderBy(['marca', 'modelo', 'id']);
    res.json({ items: filas.map(aVehiculoUsuarioJson) });
  });

  router.post('/mis-vehiculos', conSesion, async (req, res) => {
    const columnas = await columnasVehiculoUsuario(db, esquemaVehiculoUsuario.parse(req.body));
    const [{ id }] = await db('vehiculo_usuario')
      .insert({ usuario_id: req.usuario!.id, ...columnas })
      .returning('id');
    const fila = await db('vehiculo_usuario_detalle').where('id', id).first();
    res.status(201).json(aVehiculoUsuarioJson(fila));
  });

  router.put('/mis-vehiculos/:id', conSesion, async (req, res) => {
    const id = idDe(req);
    const columnas = await columnasVehiculoUsuario(db, esquemaVehiculoUsuario.parse(req.body));
    const n = await db('vehiculo_usuario')
      .where({ id, usuario_id: req.usuario!.id })
      .update(columnas);
    if (n === 0) throw noEncontrado();
    res.json(aVehiculoUsuarioJson(await db('vehiculo_usuario_detalle').where('id', id).first()));
  });

  router.delete('/mis-vehiculos/:id', conSesion, async (req, res) => {
    const n = await db('vehiculo_usuario')
      .where({ id: idDe(req), usuario_id: req.usuario!.id })
      .delete();
    if (n === 0) throw noEncontrado();
    res.status(204).end();
  });

  // Administración del catálogo (P2)
  const soloAdmin = [conSesion, requerirRol('admin')];
  const duplicado = (error: unknown) => {
    if (codigoPg(error) === PG.VIOLACION_UNICA) {
      return new AppError(409, 'MODELO_DUPLICADO', 'Ya existe un modelo con esa marca y modelo.');
    }
    return error;
  };

  router.post('/admin/vehiculos-modelo', ...soloAdmin, async (req, res) => {
    const datos = esquemaDatosVehiculo.parse(req.body);
    try {
      const [fila] = await db('vehiculo_modelo').insert(aColumnas(datos)).returning('*');
      res.status(201).json(aModeloJson(fila));
    } catch (error) {
      throw duplicado(error);
    }
  });

  router.put('/admin/vehiculos-modelo/:id', ...soloAdmin, async (req, res) => {
    const id = idDe(req);
    const datos = esquemaDatosVehiculo.parse(req.body);
    let fila;
    try {
      [fila] = await db('vehiculo_modelo').where('id', id).update(aColumnas(datos)).returning('*');
    } catch (error) {
      throw duplicado(error);
    }
    if (!fila) throw new AppError(404, 'NO_ENCONTRADO', 'El modelo no existe.');
    res.json(aModeloJson(fila));
  });

  router.delete('/admin/vehiculos-modelo/:id', ...soloAdmin, async (req, res) => {
    let n;
    try {
      n = await db('vehiculo_modelo').where('id', idDe(req)).delete();
    } catch (error) {
      if (codigoPg(error) === PG.VIOLACION_FK) {
        throw new AppError(
          409,
          'MODELO_EN_USO',
          'Hay usuarios con este modelo guardado: no se puede eliminar.',
        );
      }
      throw error;
    }
    if (n === 0) throw new AppError(404, 'NO_ENCONTRADO', 'El modelo no existe.');
    res.status(204).end();
  });

  return router;
}
