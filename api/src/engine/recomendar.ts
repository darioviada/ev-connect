// Punto de entrada del motor (SPEC §6): urgencia → filtros excluyentes → estimaciones → scoring → orden.
import { CONFIG_MOTOR, type ConfigMotor } from './config.js';
import { evaluarDisponibilidad } from './disponibilidad.js';
import {
  alcanceMaximoKm,
  autonomiaKm,
  esAlcanzable,
  esCompatible,
  estimarCarga,
  potenciaEfectivaKw,
  socLlegadaPct,
  urgenciaDe,
} from './reglas.js';
import { estrategiaWSM, type ScoringStrategy, type ValoresCriterios } from './scoring.js';
import { aFechaHora, aMinutosLocales } from './tiempo.js';
import type {
  CandidatoMotor,
  CodigoSinResultados,
  Descarte,
  LatLng,
  Metricas,
  Modo,
  Recomendacion,
  ResultadoMotor,
  Trayecto,
  VehiculoMotor,
} from './tipos.js';

export interface EntradaMotor {
  vehiculo: VehiculoMotor;
  bateriaPct: number;
  modo: Modo;
  origen: LatLng;
  destino?: LatLng;
  /** Solo modo ruta: trayecto directo origen → destino (para calcular el desvío). */
  trayectoDirecto?: Trayecto;
  /** Inyectable para tests. */
  ahora: Date;
  candidatos: readonly CandidatoMotor[];
  estrategia?: ScoringStrategy;
  config?: Partial<ConfigMotor>;
}

const MENSAJES: Record<CodigoSinResultados, string> = {
  SIN_CARGADORES_CERCANOS: 'No hay cargadores activos cerca de la ubicación o de la ruta indicada.',
  SIN_COMPATIBLES:
    'Hay cargadores cerca, pero ninguno es compatible con el conector de tu vehículo.',
  FUERA_DE_AUTONOMIA:
    'Hay cargadores compatibles, pero ninguno está al alcance con la batería actual (margen de seguridad del 10 %).',
  SIN_DISPONIBILIDAD:
    'Los cargadores compatibles y al alcance no están disponibles en las próximas 2 horas.',
};

interface Evaluado {
  candidato: CandidatoMotor;
  metricas: Metricas;
  valores: ValoresCriterios;
  advertencias: string[];
}

const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;

export function recomendar(entrada: EntradaMotor): ResultadoMotor {
  const config: ConfigMotor = { ...CONFIG_MOTOR, ...entrada.config };
  const estrategia = entrada.estrategia ?? estrategiaWSM;
  validarEntrada(entrada);

  const { vehiculo, bateriaPct } = entrada;
  const urgencia = urgenciaDe(bateriaPct);
  const pesos = config.pesos[urgencia];
  const base = {
    urgencia,
    autonomiaActualKm: r1(autonomiaKm(vehiculo, bateriaPct)),
    pesos,
    estrategia: estrategia.nombre,
  };
  const sinResultados = (codigo: CodigoSinResultados, descartados: Descarte[]): ResultadoMotor => ({
    ...base,
    recomendaciones: [],
    descartados,
    sinResultados: { codigo, mensaje: MENSAJES[codigo] },
  });

  if (entrada.candidatos.length === 0) return sinResultados('SIN_CARGADORES_CERCANOS', []);

  const descartados: Descarte[] = [];
  const descartar = (c: CandidatoMotor, motivo: Descarte['motivo'], detalle: string) =>
    descartados.push({ cargadorId: c.cargador.id, nombre: c.cargador.nombre, motivo, detalle });

  // 1. Compatibilidad de conector
  const compatibles = entrada.candidatos.filter((c) => {
    const ok = esCompatible(vehiculo, c.cargador.tipoConector);
    if (!ok) {
      descartar(
        c,
        'CONECTOR_INCOMPATIBLE',
        `Conector ${c.cargador.tipoConector} no compatible con ${vehiculo.tipoConector}.`,
      );
    }
    return ok;
  });
  if (compatibles.length === 0) return sinResultados('SIN_COMPATIBLES', descartados);

  // 2. Alcanzable con la batería actual
  const alcanzables = compatibles.filter((c) => {
    const ok = esAlcanzable(vehiculo, bateriaPct, c.desdeOrigen.distanciaKm, config);
    if (!ok) {
      descartar(
        c,
        'FUERA_DE_AUTONOMIA',
        `A ${r1(c.desdeOrigen.distanciaKm)} km; con la batería actual se llega a ${r1(alcanceMaximoKm(vehiculo, bateriaPct, config))} km como máximo.`,
      );
    }
    return ok;
  });
  if (alcanzables.length === 0) return sinResultados('FUERA_DE_AUTONOMIA', descartados);

  // 3. Estimaciones y disponibilidad en la ventana de carga
  const ahoraMin = aMinutosLocales(entrada.ahora, config.zonaHoraria);
  const evaluados: Evaluado[] = [];
  for (const c of alcanzables) {
    const resultado = evaluar(c, entrada, config, ahoraMin);
    if ('detalle' in resultado) descartar(c, 'SIN_DISPONIBILIDAD', resultado.detalle);
    else evaluados.push(resultado);
  }
  if (evaluados.length === 0) return sinResultados('SIN_DISPONIBILIDAD', descartados);

  // 4. Scoring y orden (desempate: menor distancia, luego nombre)
  const puntajes = estrategia.puntuar(
    evaluados.map((e) => e.valores),
    pesos,
    config.rangosMinimos,
  );
  const ordenados = evaluados
    .map((e, i) => ({ ...e, ...puntajes[i]! }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.metricas.distanciaKm - b.metricas.distanciaKm ||
        a.candidato.cargador.nombre.localeCompare(b.candidato.cargador.nombre, 'es'),
    );

  const recomendaciones: Recomendacion[] = ordenados.map((e, i) => ({
    cargador: e.candidato.cargador,
    metricas: e.metricas,
    score: r1(e.score),
    desglose: Object.fromEntries(
      Object.entries(e.desglose).map(([criterio, d]) => [
        criterio,
        { valor: r2(d.valor), normalizado: r2(d.normalizado), peso: d.peso, aporte: r1(d.aporte) },
      ]),
    ) as Recomendacion['desglose'],
    mejorOpcion: i === 0,
    advertencias: e.advertencias,
  }));

  return { ...base, recomendaciones, descartados, sinResultados: null };
}

function evaluar(
  c: CandidatoMotor,
  entrada: EntradaMotor,
  config: ConfigMotor,
  ahoraMin: number,
): Evaluado | { detalle: string } {
  const { vehiculo, bateriaPct } = entrada;
  const distanciaKm = c.desdeOrigen.distanciaKm;
  const viajeMin = c.desdeOrigen.duracionMin;

  const socLlegada = socLlegadaPct(vehiculo, bateriaPct, distanciaKm);
  const potencia = potenciaEfectivaKw(vehiculo, c.cargador, config.eficienciaCarga);
  const carga = estimarCarga(vehiculo, socLlegada, potencia, c.cargador.precioKwh, config);

  const llegadaMin = ahoraMin + viajeMin;
  const disp = evaluarDisponibilidad({
    llegadaMin,
    duracionMin: carga.cargaMin,
    franjas: c.franjas,
    reservas: c.reservas,
    esperaMaximaMin: config.esperaMaximaMin,
  });
  if (!disp.disponible) return { detalle: disp.detalle };

  // Modo ruta: el criterio de distancia es el desvío respecto del camino directo.
  let desvioKm: number | undefined;
  let desvioMin: number | undefined;
  if (entrada.modo === 'ruta') {
    const directo = entrada.trayectoDirecto!;
    const destino = c.haciaDestino!;
    desvioKm = Math.max(0, distanciaKm + destino.distanciaKm - directo.distanciaKm);
    desvioMin = Math.max(0, viajeMin + destino.duracionMin - directo.duracionMin);
  }

  const inicio = aFechaHora(disp.inicioMin);
  const fin = aFechaHora(disp.inicioMin + carga.cargaMin);
  const metricas: Metricas = {
    distanciaKm: r2(distanciaKm),
    ...(desvioKm !== undefined ? { desvioKm: r2(desvioKm), desvioMin: r1(desvioMin!) } : {}),
    viajeMin: r1(viajeMin),
    esperaMin: r1(disp.esperaMin),
    cargaMin: r1(carga.cargaMin),
    totalMin: r1(viajeMin + disp.esperaMin + carga.cargaMin),
    energiaKwh: r2(carga.energiaKwh),
    costoEstimado: Math.round(carga.costoEstimado),
    potenciaEfectivaKw: r2(potencia),
    socLlegadaPct: r1(socLlegada),
    objetivoPct: r1(carga.objetivoPct),
    // Si la carga terminara después de medianoche, la ventana se informa hasta las 23:59 de ese día.
    horarioCarga: {
      fecha: inicio.fecha,
      horaInicio: inicio.hora,
      horaFin: fin.fecha === inicio.fecha ? fin.hora : '23:59',
    },
  };

  const advertencias: string[] = [];
  if (socLlegada < config.socBajoAdvertenciaPct) {
    advertencias.push(`Llegarías con poca batería (${r1(socLlegada)} %).`);
  }
  if (disp.esperaPorHorario) {
    advertencias.push(`Fuera de horario al llegar: disponible desde las ${inicio.hora}.`);
  }
  if (disp.esperaPorReserva) {
    advertencias.push(`Hay una reserva al llegar: se libera a las ${inicio.hora}.`);
  }
  if (c.cargador.tipo === 'privado') {
    advertencias.push('Cargador privado: la reserva queda pendiente hasta que el dueño la acepte.');
  }

  return {
    candidato: c,
    metricas,
    valores: {
      distancia: desvioKm ?? distanciaKm,
      espera: disp.esperaMin,
      carga: carga.cargaMin,
      costo: carga.costoEstimado,
    },
    advertencias,
  };
}

function validarEntrada(entrada: EntradaMotor) {
  if (!(entrada.bateriaPct >= 0 && entrada.bateriaPct <= 100)) {
    throw new RangeError('bateriaPct debe estar entre 0 y 100');
  }
  const v = entrada.vehiculo;
  if (!(v.capacidadBateriaKwh > 0) || !(v.consumoKwhPor100km > 0)) {
    throw new RangeError('La capacidad y el consumo del vehículo deben ser positivos');
  }
  if (entrada.modo === 'ruta') {
    if (!entrada.destino || !entrada.trayectoDirecto) {
      throw new TypeError('El modo ruta requiere destino y trayectoDirecto');
    }
    if (entrada.candidatos.some((c) => !c.haciaDestino)) {
      throw new TypeError('En modo ruta cada candidato requiere haciaDestino');
    }
  }
}
