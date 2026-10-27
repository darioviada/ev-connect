// HU-006 a HU-009 — POST /recomendaciones: resuelve el vehículo, preselecciona cargadores (SQL espacial),
// consulta el RoutingProvider, carga franjas y reservas activas y ejecuta el motor (puro).
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Knex } from 'knex';
import { z } from 'zod';
import type { TipoConector, VehiculoMotor } from '../../engine/tipos.js';
import { AppError } from '../../errors.js';
import { autenticar, type UsuarioAutenticado } from '../../middleware/auth.js';
import { haversineM } from '../../routing/offline.js';
import type { DependenciasApi } from '../comun/dependencias.js';
import { esquemaLatLng } from '../comun/esquemas.js';
import { esquemaDatosVehiculo } from '../vehiculos/vehiculos.routes.js';
import { calcularRecomendacion } from './servicio.js';

const esquemaPedido = z
  .object({
    vehiculo: z.union([
      z.object({ modeloId: z.uuid() }).strict(),
      z.object({ vehiculoUsuarioId: z.uuid() }).strict(),
      z.object({ personalizado: esquemaDatosVehiculo }).strict(),
    ]),
    bateriaPct: z.number().min(0).max(100),
    modo: z.enum(['ubicacion', 'ruta']),
    origen: esquemaLatLng,
    destino: esquemaLatLng.optional(),
  })
  .superRefine((p, ctx) => {
    if (p.modo === 'ruta') {
      if (!p.destino) {
        ctx.addIssue({
          code: 'custom',
          path: ['destino'],
          message: 'El modo ruta requiere un destino.',
        });
      } else if (haversineM(p.origen, p.destino) < 500) {
        ctx.addIssue({
          code: 'custom',
          path: ['destino'],
          message: 'El destino debe estar a más de 500 m del origen.',
        });
      }
    }
  });

type Pedido = z.infer<typeof esquemaPedido>;

interface VehiculoResuelto {
  descripcion: string;
  motor: VehiculoMotor;
}

const aMotor = (f: {
  capacidad_bateria: number;
  consumo: number;
  tipo_conector: TipoConector;
  potencia_max_ac: number;
  potencia_max_dc: number | null;
}): VehiculoMotor => ({
  capacidadBateriaKwh: f.capacidad_bateria,
  consumoKwhPor100km: f.consumo,
  tipoConector: f.tipo_conector,
  potenciaMaxAcKw: f.potencia_max_ac,
  potenciaMaxDcKw: f.potencia_max_dc,
});

async function resolverVehiculo(
  db: Knex,
  v: Pedido['vehiculo'],
  usuario: UsuarioAutenticado | undefined,
): Promise<VehiculoResuelto> {
  if ('personalizado' in v) {
    const p = v.personalizado;
    return {
      descripcion: `${p.marca} ${p.modelo}`,
      motor: {
        capacidadBateriaKwh: p.capacidadBateriaKwh,
        consumoKwhPor100km: p.consumoKwhPor100km,
        tipoConector: p.tipoConector,
        potenciaMaxAcKw: p.potenciaMaxAcKw,
        potenciaMaxDcKw: p.potenciaMaxDcKw,
      },
    };
  }
  if ('modeloId' in v) {
    const f = await db('vehiculo_modelo').where('id', v.modeloId).first();
    if (!f)
      throw new AppError(404, 'VEHICULO_NO_ENCONTRADO', 'El modelo no existe en el catálogo.');
    return { descripcion: `${f.marca} ${f.modelo}`, motor: aMotor(f) };
  }
  if (!usuario) {
    throw new AppError(401, 'NO_AUTENTICADO', 'Iniciá sesión para usar tus vehículos guardados.');
  }
  const f = await db('vehiculo_usuario_detalle')
    .where({ id: v.vehiculoUsuarioId, usuario_id: usuario.id })
    .first();
  if (!f) throw new AppError(404, 'VEHICULO_NO_ENCONTRADO', 'El vehículo no existe o no es tuyo.');
  return { descripcion: `${f.marca} ${f.modelo}`, motor: aMotor(f) };
}

export function recomendacionesRouter(deps: DependenciasApi): Router {
  const { db, config, rutas, reloj } = deps;
  const router = Router();

  router.post(
    '/recomendaciones',
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
    autenticar(deps, { obligatorio: false }),
    async (req, res) => {
      const pedido = esquemaPedido.parse(req.body);
      const vehiculo = await resolverVehiculo(db, pedido.vehiculo, req.usuario);

      const calculo = await calcularRecomendacion(
        { db, rutas, engine: config.engine, reloj },
        {
          vehiculo: vehiculo.motor,
          bateriaPct: pedido.bateriaPct,
          modo: pedido.modo,
          origen: pedido.origen,
          ...(pedido.destino ? { destino: pedido.destino } : {}),
        },
      );
      const { resultado, preseleccion: pre } = calculo;

      // Modo ruta: camino real por calles para dibujar en el mapa (solo con Google; offline → null).
      const trazado =
        pedido.modo === 'ruta' ? await rutas.trazado(pedido.origen, pedido.destino!) : null;
      const r5 = (x: number) => Math.round(x * 1e5) / 1e5;

      deps.logger.info(
        {
          candidatos: pre.filas.length,
          elementosConsultados: calculo.elementosConsultados,
          proveedor: rutas.nombre,
        },
        'Recomendación calculada',
      );

      res.json({
        ...resultado,
        vehiculo: { descripcion: vehiculo.descripcion, ...vehiculo.motor },
        modo: pedido.modo,
        origen: pedido.origen,
        destino: pedido.destino ?? null,
        proveedorRutas: rutas.nombre,
        trazado: trazado
          ? {
              puntos: trazado.puntos.map((p) => [r5(p.lat), r5(p.lng)]),
              distanciaKm: Math.round(trazado.distanciaM / 100) / 10,
              duracionMin: Math.round(trazado.duracionS / 60),
              fuente: trazado.fuente,
            }
          : null,
        advertencias: calculo.advertencias,
        meta: {
          candidatosEvaluados: pre.filas.length,
          distanciaPreseleccionKm: pre.distanciaKm,
          preseleccionAmpliada: pre.ampliada,
          elementosConsultados: calculo.elementosConsultados,
          elementosDesdeCache: calculo.elementosDesdeCache,
        },
      });
    },
  );

  return router;
}
