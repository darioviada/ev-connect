// HU-002 catálogo (público, solo lectura para usuarios), HU-003 vehículos propios y administración del catálogo (P2).
// Fotos del catálogo (D-047): se guardan en la base y se sirven desde GET /vehiculos-modelo/:id/foto.
import express, { Router } from 'express';
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

/** Columnas de la foto (LEFT JOIN con vehiculo_foto; null si el modelo no tiene). */
interface ColumnasFoto {
  foto_actualizado?: Date | string | null;
  foto_credito?: string | null;
  foto_fuente?: string | null;
}

/** URL de la foto con la fecha de actualización como versión (el navegador la cachea sin riesgo). */
const fotoJson = (modeloId: string | null, f: ColumnasFoto) =>
  modeloId && f.foto_actualizado
    ? {
        fotoUrl: `/api/v1/vehiculos-modelo/${modeloId}/foto?v=${new Date(f.foto_actualizado).getTime()}`,
        fotoCredito: f.foto_credito ?? null,
        fotoFuenteUrl: f.foto_fuente ?? null,
      }
    : { fotoUrl: null, fotoCredito: null, fotoFuenteUrl: null };

/** Agrega las columnas de la foto a una consulta (por el id de modelo indicado). */
function conFoto(query: Knex.QueryBuilder, columnaModeloId: string) {
  return query
    .leftJoin('vehiculo_foto as vf', 'vf.modelo_id', columnaModeloId)
    .select(
      'vf.actualizado as foto_actualizado',
      'vf.credito as foto_credito',
      'vf.fuente_url as foto_fuente',
    );
}

export const aModeloJson = (f: FilaVehiculo & ColumnasFoto) => ({
  ...fotoJson(f.id, f),
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
  f: FilaVehiculo & ColumnasFoto & { modelo_id: string | null; personalizado: boolean },
) => ({
  ...aModeloJson(f),
  // La foto es la del modelo del catálogo (un vehículo cargado a mano no tiene)
  ...fotoJson(f.modelo_id, f),
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

// --- Fotos ------------------------------------------------------------------------------------

const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_FOTO_BYTES = 2 * 1024 * 1024;

/** Verifica la firma del archivo: el tipo declarado no alcanza (podría no ser una imagen). */
export function coincideFirma(b: Buffer, tipo: string): boolean {
  if (tipo === 'image/jpeg') return b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (tipo === 'image/png') {
    return (
      b.length > 8 &&
      b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }
  if (tipo === 'image/webp') {
    return (
      b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP'
    );
  }
  return false;
}

const esquemaCreditoFoto = z
  .object({
    credito: z.string().trim().min(1).max(300).optional(),
    fuenteUrl: z
      .url({ protocol: /^https?$/ })
      .max(500)
      .optional(),
  })
  .strict();

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
    const filas = await conFoto(query.select('vehiculo_modelo.*'), 'vehiculo_modelo.id')
      .orderBy(['marca', 'modelo'])
      .limit(pag.limit)
      .offset(pag.offset);
    res.json(paginado(filas.map(aModeloJson), total, pag));
  });

  // Foto del modelo (pública). La URL lleva la versión, así que se puede cachear.
  router.get('/vehiculos-modelo/:id/foto', async (req, res) => {
    const foto = await db('vehiculo_foto')
      .where('modelo_id', idDe(req))
      .first('contenido', 'tipo_mime', 'actualizado');
    if (!foto) throw new AppError(404, 'SIN_FOTO', 'El modelo no tiene foto.');
    res
      .set('Content-Type', foto.tipo_mime)
      .set('Cache-Control', 'public, max-age=86400')
      .set('Last-Modified', new Date(foto.actualizado).toUTCString())
      .send(foto.contenido);
  });

  // Vehículos propios
  // Vehículos propios con la foto del modelo del catálogo
  const detalle = () => conFoto(db('vehiculo_usuario_detalle as d').select('d.*'), 'd.modelo_id');

  router.get('/mis-vehiculos', conSesion, async (req, res) => {
    const filas = await detalle()
      .where('d.usuario_id', req.usuario!.id)
      .orderBy(['d.marca', 'd.modelo', 'd.id']);
    res.json({ items: filas.map(aVehiculoUsuarioJson) });
  });

  router.post('/mis-vehiculos', conSesion, async (req, res) => {
    const columnas = await columnasVehiculoUsuario(db, esquemaVehiculoUsuario.parse(req.body));
    const [{ id }] = await db('vehiculo_usuario')
      .insert({ usuario_id: req.usuario!.id, ...columnas })
      .returning('id');
    const fila = await detalle().where('d.id', id).first();
    res.status(201).json(aVehiculoUsuarioJson(fila));
  });

  router.put('/mis-vehiculos/:id', conSesion, async (req, res) => {
    const id = idDe(req);
    const columnas = await columnasVehiculoUsuario(db, esquemaVehiculoUsuario.parse(req.body));
    const n = await db('vehiculo_usuario')
      .where({ id, usuario_id: req.usuario!.id })
      .update(columnas);
    if (n === 0) throw noEncontrado();
    res.json(aVehiculoUsuarioJson(await detalle().where('d.id', id).first()));
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
    res.json(aModeloJson(await modeloConFoto(id)));
  });

  const modeloConFoto = (id: string) =>
    conFoto(db('vehiculo_modelo').select('vehiculo_modelo.*'), 'vehiculo_modelo.id')
      .where('vehiculo_modelo.id', id)
      .first();

  // Subir o reemplazar la foto: el cuerpo es la imagen (Content-Type image/jpeg, png o webp, hasta 2 MB).
  // El crédito y la fuente van como parámetros (?credito=…&fuenteUrl=…); si no se indican, quedan vacíos.
  router.put(
    '/admin/vehiculos-modelo/:id/foto',
    ...soloAdmin,
    express.raw({ type: () => true, limit: MAX_FOTO_BYTES }),
    async (req, res) => {
      const id = idDe(req);
      const tipo = (req.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
      const cuerpo = req.body as unknown;
      if (
        !(TIPOS_FOTO as readonly string[]).includes(tipo) ||
        !Buffer.isBuffer(cuerpo) ||
        !coincideFirma(cuerpo, tipo)
      ) {
        throw new AppError(400, 'FOTO_INVALIDA', 'Subí una imagen JPEG, PNG o WebP de hasta 2 MB.');
      }
      const { credito, fuenteUrl } = esquemaCreditoFoto.parse(req.query);
      if (!(await db('vehiculo_modelo').where('id', id).first('id'))) {
        throw new AppError(404, 'NO_ENCONTRADO', 'El modelo no existe.');
      }
      await db('vehiculo_foto')
        .insert({
          modelo_id: id,
          contenido: cuerpo,
          tipo_mime: tipo,
          credito: credito ?? null,
          fuente_url: fuenteUrl ?? null,
          actualizado: db.fn.now(),
        })
        .onConflict('modelo_id')
        .merge();
      res.json(aModeloJson(await modeloConFoto(id)));
    },
  );

  router.delete('/admin/vehiculos-modelo/:id/foto', ...soloAdmin, async (req, res) => {
    const n = await db('vehiculo_foto').where('modelo_id', idDe(req)).delete();
    if (n === 0) throw new AppError(404, 'SIN_FOTO', 'El modelo no tiene foto.');
    res.status(204).end();
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
