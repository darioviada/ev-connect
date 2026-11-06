// GET /geocodificar?q=&cerca=lat,lng — búsqueda de direcciones (SPEC §7) y GET /configuracion (datos
// públicos que la interfaz necesita para adaptarse, sin secretos). Con Nominatim, la interfaz debe llamar
// solo cuando el usuario confirma la búsqueda (sin autocompletado, por la política de uso).
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { AppError } from '../../errors.js';
import { StaticGeocodingProvider } from '../../routing/geocodificacion/static.js';
import { GeocodificacionNoDisponibleError } from '../../routing/geocodificacion/tipos.js';
import type { DependenciasApi } from '../comun/dependencias.js';

const esquemaCerca = z
  .string()
  .transform((s) => s.split(',').map(Number))
  .pipe(z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)]))
  .transform(([lat, lng]) => ({ lat, lng }));

export const AVISO_SIN_DIRECCIONES =
  'La búsqueda de direcciones no está disponible en este momento: se muestran solo barrios y ciudades. También podés marcar el punto en el mapa.';

export function geocodificacionRouter(deps: DependenciasApi): Router {
  const router = Router();
  const respaldo = new StaticGeocodingProvider();

  router.get('/configuracion', (_req, res) => {
    res.json({
      geocodificacion: deps.geocoding.nombre,
      proveedorRutas: deps.rutas.nombre,
      modoAuth: deps.auth.modo,
    });
  });

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
      const { q, cerca } = z
        .object({ q: z.string().trim().min(2).max(100), cerca: esquemaCerca.optional() })
        .parse(req.query);
      try {
        const resultados = await deps.geocoding.buscar(q, cerca ? { cerca } : {});
        res.json({ proveedor: deps.geocoding.nombre, resultados, aviso: null });
      } catch (error) {
        if (!(error instanceof GeocodificacionNoDisponibleError)) throw error;
        // Si el servicio externo no responde, se cae a la lista fija (barrios y ciudades) y se avisa.
        deps.logger.warn({ err: error }, 'Geocodificación no disponible: se usa la lista fija');
        res.json({
          proveedor: respaldo.nombre,
          resultados: await respaldo.buscar(q),
          aviso: AVISO_SIN_DIRECCIONES,
        });
      }
    },
  );
  return router;
}
