// GET /geocodificar?q= — búsqueda de direcciones (SPEC §7). Con Nominatim, la interfaz debe llamar
// solo cuando el usuario confirma la búsqueda (sin autocompletado, por la política de uso).
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { AppError } from '../../errors.js';
import { GeocodificacionNoDisponibleError } from '../../routing/geocodificacion/tipos.js';
import type { DependenciasApi } from '../comun/dependencias.js';

export function geocodificacionRouter(deps: DependenciasApi): Router {
  const router = Router();
  router.get(
    '/geocodificar',
    rateLimit({
      windowMs: 60 * 1000,
      limit: 30,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_req, _res, next) =>
        next(
          new AppError(
            429,
            'DEMASIADAS_SOLICITUDES',
            'Demasiadas búsquedas seguidas. Esperá un minuto.',
          ),
        ),
    }),
    async (req, res) => {
      const { q } = z.object({ q: z.string().trim().min(2).max(100) }).parse(req.query);
      try {
        const resultados = await deps.geocoding.buscar(q);
        res.json({ proveedor: deps.geocoding.nombre, resultados });
      } catch (error) {
        if (error instanceof GeocodificacionNoDisponibleError) {
          throw new AppError(
            503,
            'GEOCODIFICACION_NO_DISPONIBLE',
            'La búsqueda de direcciones no está disponible: marcá la ubicación en el mapa.',
          );
        }
        throw error;
      }
    },
  );
  return router;
}
