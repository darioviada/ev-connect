// P2 — Gestión de perfiles: listar usuarios, habilitar/deshabilitar y (solo en modo local) cambiar el rol.
// En modo Cognito el rol lo dan los grupos del User Pool (se administran en la consola de AWS).
import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../../errors.js';
import { autenticar, requerirRol } from '../../middleware/auth.js';
import type { DependenciasApi } from '../comun/dependencias.js';
import {
  contarTotal,
  esquemaPaginacion,
  idDe,
  paginado,
  patronContiene,
} from '../comun/esquemas.js';

export function adminUsuariosRouter(deps: DependenciasApi): Router {
  const { db, auth } = deps;
  const router = Router();
  const soloAdmin = [autenticar(deps, { obligatorio: true }), requerirRol('admin')];
  const modoLocal = auth.modo === 'local';

  const consulta = () => {
    const q = db('usuario as u').select(
      'u.id',
      'u.nombre',
      'u.email',
      'u.activo',
      'u.fecha_registro',
    );
    // dev_credencial solo existe en modo local
    if (modoLocal) q.leftJoin('dev_credencial as d', 'd.usuario_id', 'u.id').select('d.rol');
    return q;
  };

  const aJson = (u: {
    id: string;
    nombre: string;
    email: string;
    activo: boolean;
    fecha_registro: string;
    rol?: string | null;
  }) => ({
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    activo: u.activo,
    fechaRegistro: u.fecha_registro,
    // En modo Cognito el rol no se guarda en la base.
    rol: modoLocal ? (u.rol ?? null) : null,
  });

  router.get('/admin/usuarios', ...soloAdmin, async (req, res) => {
    const { q, ...pag } = esquemaPaginacion
      .extend({ q: z.string().trim().max(100).optional() })
      .parse(req.query);
    const query = consulta();
    if (q)
      query.where((w) =>
        w.whereILike('u.nombre', patronContiene(q)).orWhereILike('u.email', patronContiene(q)),
      );
    const total = await contarTotal(query);
    const filas = await query.orderBy(['u.nombre', 'u.id']).limit(pag.limit).offset(pag.offset);
    res.json(paginado(filas.map(aJson), total, pag));
  });

  router.patch('/admin/usuarios/:id', ...soloAdmin, async (req, res) => {
    const id = idDe(req);
    const cambios = z
      .object({ activo: z.boolean().optional(), rol: z.enum(['user', 'admin']).optional() })
      .strict()
      .refine((c) => c.activo !== undefined || c.rol !== undefined, 'Indicá activo y/o rol.')
      .parse(req.body);

    const usuario = await db('usuario').where('id', id).first('id');
    if (!usuario) throw new AppError(404, 'NO_ENCONTRADO', 'El usuario no existe.');
    if (id === req.usuario!.id && (cambios.activo === false || cambios.rol === 'user')) {
      throw new AppError(
        409,
        'AUTOGESTION_NO_PERMITIDA',
        'No podés deshabilitarte ni quitarte el rol de administrador.',
      );
    }
    if (cambios.rol !== undefined) {
      if (!modoLocal) {
        throw new AppError(
          400,
          'ROL_NO_EDITABLE',
          'En modo Cognito el rol se asigna con los grupos del User Pool.',
        );
      }
      const n = await db('dev_credencial').where('usuario_id', id).update({ rol: cambios.rol });
      if (n === 0) {
        throw new AppError(
          409,
          'SIN_CREDENCIAL',
          'El usuario no tiene acceso local: no se le puede asignar rol.',
        );
      }
    }
    if (cambios.activo !== undefined) {
      await db('usuario').where('id', id).update({ activo: cambios.activo });
    }
    res.json(aJson(await consulta().where('u.id', id).first()));
  });

  return router;
}
