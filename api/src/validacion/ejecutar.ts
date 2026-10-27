// Ejecuta la validación: para cada escenario, el camino real de la API (sistema) y la evaluación de todos
// los cargadores activos por fuerza bruta (base y óptimo), con el mismo RoutingProvider y los mismos datos.
import type { Knex } from 'knex';
import type { Config } from '../config/index.js';
import { columnasCargador, type FilaCargador } from '../modules/cargadores/cargadores.repo.js';
import {
  calcularRecomendacion,
  construirCandidatos,
  ejecutarMotor,
  type PedidoMotor,
} from '../modules/recomendaciones/servicio.js';
import type { RoutingProvider } from '../routing/tipos.js';
import { analizarEscenario, type FilaEscenario } from './analisis.js';
import { generarEscenarios, type Escenario, type ModeloCatalogo } from './escenarios.js';

export interface OpcionesValidacion {
  db: Knex;
  rutas: RoutingProvider;
  engine: Config['engine'];
  zonaHoraria: string;
  semilla: number;
  cantidad: number;
  proporcionRuta: number;
  alProgresar?: (hechos: number, total: number) => void;
}

export interface ResultadoValidacion {
  escenarios: Escenario[];
  filas: FilaEscenario[];
  cargadoresActivos: number;
  elementosConsultados: number;
}

export async function cargarCatalogo(db: Knex): Promise<ModeloCatalogo[]> {
  const filas = await db('vehiculo_modelo').orderBy(['marca', 'modelo']);
  return filas.map((f) => ({
    id: f.id,
    descripcion: `${f.marca} ${f.modelo}`,
    vehiculo: {
      capacidadBateriaKwh: f.capacidad_bateria,
      consumoKwhPor100km: f.consumo,
      tipoConector: f.tipo_conector,
      potenciaMaxAcKw: f.potencia_max_ac,
      potenciaMaxDcKw: f.potencia_max_dc,
    },
  }));
}

export async function ejecutarValidacion(o: OpcionesValidacion): Promise<ResultadoValidacion> {
  const escenarios = generarEscenarios({
    semilla: o.semilla,
    cantidad: o.cantidad,
    catalogo: await cargarCatalogo(o.db),
    proporcionRuta: o.proporcionRuta,
  });
  const activos: FilaCargador[] = await o
    .db('cargador as c')
    .select(columnasCargador(o.db))
    .where('c.estado', 'activo')
    .orderBy('c.id');

  const filas: FilaEscenario[] = [];
  let elementosConsultados = 0;
  for (const [i, esc] of escenarios.entries()) {
    const reloj = { ahora: () => esc.ahora, zonaHoraria: o.zonaHoraria };
    const ctx = { db: o.db, rutas: o.rutas, engine: o.engine, reloj };
    const pedido: PedidoMotor = {
      vehiculo: esc.modelo.vehiculo,
      bateriaPct: esc.bateriaPct,
      modo: esc.modo,
      origen: esc.origen,
      ...(esc.destino ? { destino: esc.destino } : {}),
    };

    const sistema = await calcularRecomendacion(ctx, pedido);
    const todos = await construirCandidatos(ctx, activos, pedido);
    const completo = ejecutarMotor(pedido, todos, reloj);
    elementosConsultados += sistema.elementosConsultados + todos.elementosConsultados;

    filas.push(
      analizarEscenario(
        esc,
        {
          resultado: sistema.resultado,
          candidatos: sistema.preseleccion.filas.length,
          preseleccionAmpliada: sistema.preseleccion.ampliada,
        },
        completo,
      ),
    );
    o.alProgresar?.(i + 1, escenarios.length);
  }
  return { escenarios, filas, cargadoresActivos: activos.length, elementosConsultados };
}
