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
import { distanciaRectaKm } from './geo.js';
import { estrategiaWSM, type ScoringStrategy, type ValoresCriterios } from './scoring.js';
import { aFechaHora, aMinutosLocales } from './tiempo.js';
import { planificarViaje, type ContextoViaje } from './viaje.js';
import type {
  CandidatoMotor,
  CargadorRuta,
  CodigoSinResultados,
  Descarte,
  LatLng,
  Metricas,
  Modo,
  PlanViaje,
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
  /**
   * Solo modo ruta: cargadores a lo largo de todo el viaje, posibles paradas siguientes del plan (D-045).
   * Si falta, se usan los candidatos.
   */
  cargadoresRuta?: readonly CargadorRuta[];
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
  VIAJE_NO_POSIBLE: 'No es posible completar este viaje con el vehículo elegido.',
};

interface Evaluado {
  candidato: CandidatoMotor;
  metricas: Metricas;
  valores: ValoresCriterios;
  advertencias: string[];
  plan?: PlanViaje;
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
  // Modo ruta (D-045): si con la batería actual no se llega al destino, cada primera parada se evalúa
  // con su plan de viaje completo.
  const viaje =
    entrada.modo === 'ruta'
      ? {
          distanciaKm: r1(entrada.trayectoDirecto!.distanciaKm),
          llegaSinCargar: esAlcanzable(
            vehiculo,
            bateriaPct,
            entrada.trayectoDirecto!.distanciaKm,
            config,
          ),
          alcanceConCargaCompletaKm: r1(alcanceMaximoKm(vehiculo, 100, config)),
        }
      : undefined;
  const base = {
    urgencia,
    autonomiaActualKm: r1(autonomiaKm(vehiculo, bateriaPct)),
    pesos,
    estrategia: estrategia.nombre,
    ...(viaje ? { viaje } : {}),
  };
  const sinResultados = (
    codigo: CodigoSinResultados,
    descartados: Descarte[],
    mensaje = MENSAJES[codigo],
  ): ResultadoMotor => ({
    ...base,
    recomendaciones: [],
    descartados,
    sinResultados: { codigo, mensaje },
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
  const ctxViaje = viaje && !viaje.llegaSinCargar ? contextoViaje(entrada, config) : null;
  let mejorIntento: PlanViaje | null = null;
  const evaluados: Evaluado[] = [];
  for (const c of alcanzables) {
    let plan: PlanViaje | undefined;
    if (ctxViaje) {
      plan = planificarViaje(ctxViaje, {
        cargador: { cargador: c.cargador, franjas: c.franjas, reservas: c.reservas },
        socLlegadaPct: socLlegadaPct(vehiculo, bateriaPct, c.desdeOrigen.distanciaKm),
        llegadaMin: ahoraMin + c.desdeOrigen.duracionMin,
        tramoKm: c.desdeOrigen.distanciaKm,
        viajeMin: c.desdeOrigen.duracionMin,
        restanteKm: c.haciaDestino!.distanciaKm,
      });
      if (!plan.factible) {
        const problema = plan.problema!;
        if (problema.motivo === 'SIN_ALCANCE') {
          descartar(c, 'VIAJE_NO_POSIBLE', problema.mensaje);
          if (!mejorIntento || problema.desdeKm > mejorIntento.problema!.desdeKm)
            mejorIntento = plan;
        } else {
          descartar(c, 'SIN_DISPONIBILIDAD', problema.mensaje);
        }
        continue;
      }
    }
    const resultado = evaluar(c, entrada, config, ahoraMin, plan);
    if ('detalle' in resultado) descartar(c, 'SIN_DISPONIBILIDAD', resultado.detalle);
    else evaluados.push(resultado);
  }
  // Con plan, una "primera parada" donde no hace falta cargar no es una recomendación útil: el plan
  // sigue de largo. Se descarta si hay otras opciones.
  const sinCarga = (e: Evaluado) => e.plan !== undefined && e.metricas.energiaKwh < 0.1;
  if (evaluados.some(sinCarga) && !evaluados.every(sinCarga)) {
    for (const e of evaluados.filter(sinCarga)) {
      const siguiente = e.plan!.paradas[1]?.cargador.nombre;
      descartar(
        e.candidato,
        'CARGA_INNECESARIA',
        siguiente
          ? `Con la batería al llegar no hace falta cargar acá: el plan sigue hasta ${siguiente}.`
          : 'Con la batería al llegar no hace falta cargar acá.',
      );
    }
    evaluados.splice(0, evaluados.length, ...evaluados.filter((e) => !sinCarga(e)));
  }
  if (evaluados.length === 0) {
    if (mejorIntento) {
      return sinResultados(
        'VIAJE_NO_POSIBLE',
        descartados,
        `${MENSAJES.VIAJE_NO_POSIBLE} ${mejorIntento.problema!.mensaje}`,
      );
    }
    return sinResultados('SIN_DISPONIBILIDAD', descartados);
  }

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
    ...(e.plan ? { plan: e.plan } : {}),
  }));

  return { ...base, recomendaciones, descartados, sinResultados: null };
}

/** Factor de circuito y velocidad del trayecto directo, para estimar los tramos entre paradas. */
function contextoViaje(entrada: EntradaMotor, config: ConfigMotor): ContextoViaje {
  const directo = entrada.trayectoDirecto!;
  const recta = distanciaRectaKm(entrada.origen, entrada.destino!);
  const factor = recta > 1 ? Math.min(2, Math.max(1, directo.distanciaKm / recta)) : 1.35;
  const porId = new Map<string, CargadorRuta>();
  for (const c of [...(entrada.cargadoresRuta ?? []), ...entrada.candidatos]) {
    if (!porId.has(c.cargador.id)) {
      porId.set(c.cargador.id, { cargador: c.cargador, franjas: c.franjas, reservas: c.reservas });
    }
  }
  return {
    vehiculo: entrada.vehiculo,
    destino: entrada.destino!,
    distanciaTotalKm: directo.distanciaKm,
    factorCircuito: factor,
    minPorKm: directo.distanciaKm > 0 ? directo.duracionMin / directo.distanciaKm : 1,
    cargadores: [...porId.values()],
    config,
  };
}

function evaluar(
  c: CandidatoMotor,
  entrada: EntradaMotor,
  config: ConfigMotor,
  ahoraMin: number,
  plan?: PlanViaje,
): Evaluado | { detalle: string } {
  const { vehiculo, bateriaPct } = entrada;
  const distanciaKm = c.desdeOrigen.distanciaKm;
  const viajeMin = c.desdeOrigen.duracionMin;

  const socLlegada = socLlegadaPct(vehiculo, bateriaPct, distanciaKm);
  const potencia = potenciaEfectivaKw(vehiculo, c.cargador, config.eficienciaCarga);
  // Con plan de viaje, se carga lo que necesita el tramo siguiente (lo calculó el planificador).
  const carga = estimarCarga(
    vehiculo,
    socLlegada,
    potencia,
    c.cargador.precioKwh,
    config,
    plan?.paradas[0]?.objetivoPct,
  );

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
  const paradasExtra = plan ? plan.paradas.length - 1 : 0;
  if (paradasExtra > 0) {
    advertencias.push(
      `El viaje necesita ${paradasExtra} parada${paradasExtra === 1 ? '' : 's'} más (ver el plan de viaje).`,
    );
  }

  // Con plan, espera, carga y costo se puntúan para el viaje completo (todas las paradas).
  return {
    candidato: c,
    metricas,
    valores: {
      distancia: desvioKm ?? distanciaKm,
      espera: plan ? plan.totales.esperaMin : disp.esperaMin,
      carga: plan ? plan.totales.cargaMin : carga.cargaMin,
      costo: plan ? plan.totales.costoEstimado : carga.costoEstimado,
    },
    advertencias,
    ...(plan ? { plan } : {}),
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
