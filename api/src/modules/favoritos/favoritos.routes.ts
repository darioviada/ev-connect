// HU-011 — Favoritos y rutas guardadas (requieren sesión; cada usuario ve solo los suyos).
import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../../errors.js';
import { autenticar } from '../../middleware/auth.js';
import { aCargadorJson, columnasCargador } from '../cargadores/cargadores.repo.js';
import type { DependenciasApi } from '../comun/dependencias.js';
import { esquemaLatLng, idDe } from '../comun/esquemas.js';

const MAX_RUTAS = 50;

export function favoritosRouter(deps: DependenciasApi): Router {
  const { db } = deps;
  const router = Router();
  const conSesion = autenticar(deps, { obligatorio: true });

  // --- Favoritos -----------------------------------------------------------------------------
  router.get('/favoritos', conSesion, async (req, res) => {
    const filas = await db('favorito as f')
      .join('cargador as c', 'c.id', 'f.cargador_id')
      .select(columnasCargador(db))
      .where('f.usuario_id', req.usuario!.id)
      .orderBy(['c.nombre', 'c.id']);
    res.json({ items: filas.map((f) => aCargadorJson(f)) });
  });

  router.post('/favoritos', conSesion, async (req, res) => {
    const { cargadorId } = z.object({ cargadorId: z.uuid() }).strict().parse(req.body);
    const cargador = await db('cargador').where('id', cargadorId).first('id');
    if (!cargador) throw new AppError(404, 'NO_ENCONTRADO', 'El cargador no existe.');
    const insertados = await db('favorito')
      .insert({ usuario_id: req.usuario!.id, cargador_id: cargadorId })
      .onConflict(['usuario_id', 'cargador_id'])
      .ignore()
      .returning('id');
    // Idempotente: si ya era favorito, 200 en lugar de 201.
    res.status(insertados.length > 0 ? 201 : 200).json({ cargadorId, favorito: true });
  });

  router.delete('/favoritos/:cargadorId', conSesion, async (req, res) => {
    await db('favorito')
      .where({ usuario_id: req.usuario!.id, cargador_id: idDe(req, 'cargadorId') })
      .delete();
    res.status(204).end();
  });

  // --- Rutas guardadas ------------------------------------------------------------------------
  const aRutaJson = (r: {
    id: string;
    nombre: string;
    origen_lat: number;
    origen_lng: number;
    destino_lat: number;
    destino_lng: number;
  }) => ({
    id: r.id,
    nombre: r.nombre,
    origen: { lat: r.origen_lat, lng: r.origen_lng },
    destino: { lat: r.destino_lat, lng: r.destino_lng },
  });

  router.get('/rutas-guardadas', conSesion, async (req, res) => {
    const filas = await db('ruta_guardada')
      .where('usuario_id', req.usuario!.id)
      .orderBy(['nombre', 'id']);
    res.json({ items: filas.map(aRutaJson) });
  });

  router.post('/rutas-guardadas', conSesion, async (req, res) => {
    const datos = z
      .object({
        nombre: z.string().trim().min(1).max(80),
        origen: esquemaLatLng,
        destino: esquemaLatLng,
      })
      .strict()
      .parse(req.body);
    const cantidad = await db('ruta_guardada')
      .where('usuario_id', req.usuario!.id)
      .count<{ n: string }[]>({ n: '*' });
    if (Number(cantidad[0]!.n) >= MAX_RUTAS) {
      throw new AppError(409, 'LIMITE_RUTAS', `Podés guardar hasta ${MAX_RUTAS} rutas.`);
    }
    const [fila] = await db('ruta_guardada')
      .insert({
        usuario_id: req.usuario!.id,
        nombre: datos.nombre,
        origen_lat: datos.origen.lat,
        origen_lng: datos.origen.lng,
        destino_lat: datos.destino.lat,
        destino_lng: datos.destino.lng,
      })
      .returning('*');
    res.status(201).json(aRutaJson(fila));
  });

  router.delete('/rutas-guardadas/:id', conSesion, async (req, res) => {
    const n = await db('ruta_guardada')
      .where({ id: idDe(req), usuario_id: req.usuario!.id })
      .delete();
    if (n === 0) throw new AppError(404, 'NO_ENCONTRADO', 'La ruta no existe o no es tuya.');
    res.status(204).end();
  });

  return router;
}
