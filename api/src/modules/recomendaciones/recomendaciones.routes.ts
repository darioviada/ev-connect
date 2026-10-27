// HU-006 a HU-009 — POST /recomendaciones: resuelve el vehículo, preselecciona cargadores (SQL espacial),
// consulta el RoutingProvider, carga franjas y reservas activas y ejecuta el motor (puro).
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Knex } from 'knex';
import { z } from 'zod';
import { recomendar } from '../../engine/recomendar.js';
import { esCompatible } from '../../engine/reglas.js';
import type { CandidatoMotor, TipoConector, VehiculoMotor } from '../../engine/tipos.js';
import { AppError } from '../../errors.js';
import { autenticar, type UsuarioAutenticado } from '../../middleware/auth.js';
import { haversineM } from '../../routing/offline.js';
import type { Celda } from '../../routing/tipos.js';
import {
  aCargadorMotor,
  aFranjaMotor,
  franjasPorCargador,
  type FilaCargador,
} from '../cargadores/cargadores.repo.js';
import type { DependenciasApi } from '../comun/dependencias.js';
import { CONECTORES, esquemaLatLng, hhmm } from '../comun/esquemas.js';
import { fechaRelativa } from '../comun/reloj.js';
import { esquemaDatosVehiculo } from '../vehiculos/vehiculos.routes.js';
import { preseleccionar } from './preseleccion.js';

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

const aTrayecto = (c: Celda) => ({
  distanciaKm: c.distanciaM / 1000,
  duracionMin: c.duracionS / 60,
  fuente: c.fuente,
});

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

      // Preselección: primero solo compatibles; si no hay ninguno, se traen los cercanos para que el
      // motor informe SIN_COMPATIBLES con el motivo de cada descarte.
      const compatibles = CONECTORES.filter((c) => esCompatible(vehiculo.motor, c));
      const parametros = {
        modo: pedido.modo,
        origen: pedido.origen,
        ...(pedido.destino ? { destino: pedido.destino } : {}),
        radioKm: config.engine.searchRadiusKm,
        corredorKm: config.engine.corridorKm,
        limite: config.engine.candidatesLimit,
      };
      let pre = await preseleccionar(db, { ...parametros, conectores: compatibles });
      if (pre.filas.length === 0) {
        pre = await preseleccionar(db, { ...parametros, conectores: CONECTORES });
      }
      const filas: FilaCargador[] = pre.filas;
      const destinos = filas.map((f) => ({ lat: f.lat, lng: f.lng }));

      // Rutas: origen → cargadores (y en modo ruta, también → destino y cargadores → destino).
      let elementosConsultados = 0;
      let elementosDesdeCache = 0;
      const advertencias = new Set<string>();
      const sumar = (r: Awaited<ReturnType<typeof rutas.matrix>>) => {
        elementosConsultados += r.elementosConsultados;
        elementosDesdeCache += r.elementosDesdeCache;
        r.advertencias.forEach((a) => advertencias.add(a));
        return r.celdas;
      };

      let desdeOrigen: Celda[] = [];
      let haciaDestino: Celda[] = [];
      let directo: Celda | undefined;
      if (filas.length > 0) {
        if (pedido.modo === 'ruta') {
          const fila = sumar(
            await rutas.matrix([pedido.origen], [...destinos, pedido.destino!]),
          )[0]!;
          desdeOrigen = fila.slice(0, -1);
          directo = fila.at(-1);
          haciaDestino = sumar(await rutas.matrix(destinos, [pedido.destino!])).map((f) => f[0]!);
        } else {
          desdeOrigen = sumar(await rutas.matrix([pedido.origen], destinos))[0]!;
        }
      } else if (pedido.modo === 'ruta') {
        // Sin candidatos no hace falta consultar rutas; el motor devuelve SIN_CARGADORES_CERCANOS.
        directo = { distanciaM: 0, duracionS: 0, fuente: 'offline-estimado' };
      }

      // Franjas y reservas activas (pendientes o confirmadas) cerca de la ventana de búsqueda.
      const ids = filas.map((f) => f.id);
      const franjas = await franjasPorCargador(db, ids);
      const reservas =
        ids.length === 0
          ? []
          : await db('reserva')
              .whereIn('cargador_id', ids)
              .whereNot('estado', 'cancelada')
              .whereBetween('fecha', [fechaRelativa(reloj, -1), fechaRelativa(reloj, 2)])
              .select('cargador_id', 'fecha', 'hora_inicio', 'hora_fin');

      const candidatos: CandidatoMotor[] = filas.map((f, i) => ({
        cargador: aCargadorMotor(f),
        desdeOrigen: aTrayecto(desdeOrigen[i]!),
        ...(pedido.modo === 'ruta' ? { haciaDestino: aTrayecto(haciaDestino[i]!) } : {}),
        franjas: franjas.get(f.id)!.map(aFranjaMotor),
        reservas: reservas
          .filter((r) => r.cargador_id === f.id)
          .map((r) => ({
            fecha: r.fecha,
            horaInicio: hhmm(r.hora_inicio),
            horaFin: hhmm(r.hora_fin),
          })),
      }));

      // Modo ruta: camino real por calles para dibujar en el mapa (solo con Google; offline → null).
      const trazado =
        pedido.modo === 'ruta' ? await rutas.trazado(pedido.origen, pedido.destino!) : null;
      const r5 = (x: number) => Math.round(x * 1e5) / 1e5;

      const resultado = recomendar({
        vehiculo: vehiculo.motor,
        bateriaPct: pedido.bateriaPct,
        modo: pedido.modo,
        origen: pedido.origen,
        ...(pedido.destino ? { destino: pedido.destino } : {}),
        ...(directo ? { trayectoDirecto: aTrayecto(directo) } : {}),
        ahora: reloj.ahora(),
        candidatos,
        config: { zonaHoraria: reloj.zonaHoraria },
      });

      deps.logger.info(
        { candidatos: filas.length, elementosConsultados, proveedor: rutas.nombre },
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
        advertencias: [...advertencias],
        meta: {
          candidatosEvaluados: filas.length,
          distanciaPreseleccionKm: pre.distanciaKm,
          preseleccionAmpliada: pre.ampliada,
          elementosConsultados,
          elementosDesdeCache,
        },
      });
    },
  );

  return router;
}
