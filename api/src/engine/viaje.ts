// Plan de viaje en modo ruta (D-045, desvío del SPEC §2 pedido por el autor). Puro: recibe datos y
// devuelve el plan.
//
// Desde una primera parada ya elegida, busca la secuencia de paradas que llega al destino lo antes
// posible (manejo + espera + carga), con el algoritmo de Dijkstra sobre los cargadores de la ruta.
// Para comparar caminos, cada parada siguiente suma `penalidadParadaMin` (salir de la ruta, enchufar,
// pagar): evita paradas de pocos minutos que casi no ahorran tiempo. Los tiempos informados no la incluyen.
//   - Un tramo va de un punto a un cargador compatible que acerque al destino al menos `avanceMinimoKm`,
//     o al destino, y tiene que poder recorrerse con la batería llena (margen y SoC mínimo de llegada).
//   - En cada parada se carga lo necesario para el tramo siguiente + `margenCargaViajePct` (tope 100 %),
//     en el horario disponible del cargador (franjas y reservas, espera máxima de 2 h).
//   - Si el destino no se alcanza por ningún camino, el viaje no es posible desde esa primera parada y se
//     informa dónde se corta (el punto más avanzado al que se llega).
// Simplificaciones: los tramos entre paradas se estiman (línea recta × factor de circuito del trayecto
// directo, velocidad media del trayecto directo); cada cargador guarda solo su mejor hora de llegada
// (no se comparan llegadas más tardías con más batería); carga lineal.
import type { ConfigMotor } from './config.js';
import { evaluarDisponibilidad } from './disponibilidad.js';
import { distanciaRectaKm } from './geo.js';
import {
  alcanceMaximoKm,
  esCompatible,
  estimarCarga,
  objetivoParaTramoPct,
  potenciaEfectivaKw,
} from './reglas.js';
import { aFechaHora } from './tiempo.js';
import type {
  CargadorRuta,
  LatLng,
  ParadaPlan,
  PlanViaje,
  ProblemaViaje,
  VehiculoMotor,
} from './tipos.js';

export interface ContextoViaje {
  vehiculo: VehiculoMotor;
  destino: LatLng;
  /** Distancia del trayecto directo origen → destino (km), para ubicar las paradas ("km X de Y"). */
  distanciaTotalKm: number;
  /** km por calles por km en línea recta, tomado del trayecto directo. */
  factorCircuito: number;
  /** Minutos por km, tomado del trayecto directo. */
  minPorKm: number;
  /** Cargadores sobre la ruta que pueden ser paradas siguientes. */
  cargadores: readonly CargadorRuta[];
  config: ConfigMotor;
}

/** La primera parada, con los datos que calculó el RoutingProvider. */
export interface InicioPlan {
  cargador: CargadorRuta;
  socLlegadaPct: number;
  /** Llegada a la primera parada, en minutos locales. */
  llegadaMin: number;
  /** origen → primera parada */
  tramoKm: number;
  viajeMin: number;
  /** primera parada → destino */
  restanteKm: number;
}

interface Carga {
  objetivoPct: number;
  energiaKwh: number;
  cargaMin: number;
  costoEstimado: number;
  potencia: number;
  inicioMin: number;
  esperaMin: number;
  esperaPorHorario: boolean;
  esperaPorReserva: boolean;
  salidaMin: number;
}

/** Mejor llegada conocida a un cargador (etiqueta de Dijkstra). */
interface Etiqueta {
  socLlegada: number;
  llegadaMin: number;
  /** Hora de llegada + penalidad por parada (lo que minimiza Dijkstra). */
  costo: number;
  previo: number | null;
  tramoKm: number;
  tramoEstimado: boolean;
  /** Carga en el cargador previo para recorrer el tramo hasta este. */
  cargaPrevia: Carga | null;
}

const r0 = (x: number) => Math.round(x);
const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;

export function planificarViaje(ctx: ContextoViaje, inicio: InicioPlan): PlanViaje {
  const { vehiculo, config } = ctx;
  const alcance = alcanceMaximoKm(vehiculo, 100, config);
  const estimar = (a: LatLng, b: LatLng) => distanciaRectaKm(a, b) * ctx.factorCircuito;
  const kmEnRuta = (restanteKm: number) =>
    Math.min(ctx.distanciaTotalKm, Math.max(0, ctx.distanciaTotalKm - restanteKm));
  const consumoPct = (km: number) =>
    (km * vehiculo.consumoKwhPor100km) / vehiculo.capacidadBateriaKwh;

  // Nodo 0 = primera parada; el resto, los cargadores compatibles de la ruta.
  const nodos: CargadorRuta[] = [
    inicio.cargador,
    ...ctx.cargadores.filter(
      (c) =>
        c.cargador.id !== inicio.cargador.cargador.id &&
        esCompatible(vehiculo, c.cargador.tipoConector),
    ),
  ];
  const restante = nodos.map((c, i) =>
    i === 0 ? inicio.restanteKm : estimar(c.cargador.ubicacion, ctx.destino),
  );

  /** Carga en el nodo `i` para recorrer `tramoKm`; null si el cargador no está disponible. */
  const cargarEn = (i: number, e: Etiqueta, tramoKm: number): Carga | null => {
    const cr = nodos[i]!;
    const potencia = potenciaEfectivaKw(vehiculo, cr.cargador, config.eficienciaCarga);
    const objetivo = objetivoParaTramoPct(vehiculo, tramoKm, config);
    const c = estimarCarga(
      vehiculo,
      e.socLlegada,
      potencia,
      cr.cargador.precioKwh,
      config,
      objetivo,
    );
    if (!Number.isFinite(c.cargaMin)) return null;
    const disp = evaluarDisponibilidad({
      llegadaMin: e.llegadaMin,
      duracionMin: c.cargaMin,
      franjas: cr.franjas,
      reservas: cr.reservas,
      esperaMaximaMin: config.esperaMaximaMin,
    });
    if (!disp.disponible) return null;
    return {
      ...c,
      potencia,
      inicioMin: disp.inicioMin,
      esperaMin: disp.esperaMin,
      esperaPorHorario: disp.esperaPorHorario,
      esperaPorReserva: disp.esperaPorReserva,
      salidaMin: disp.inicioMin + c.cargaMin,
    };
  };

  // --- Dijkstra por hora de llegada ---------------------------------------------------------------
  const etiquetas: (Etiqueta | null)[] = nodos.map(() => null);
  etiquetas[0] = {
    socLlegada: inicio.socLlegadaPct,
    llegadaMin: inicio.llegadaMin,
    costo: inicio.llegadaMin,
    previo: null,
    tramoKm: inicio.tramoKm,
    tramoEstimado: false,
    cargaPrevia: null,
  };
  const cerrado = nodos.map(() => false);
  const hayAlAlcance = nodos.map(() => false);
  const cargaPosible = nodos.map(() => false);
  let final: { previo: number; carga: Carga; llegadaMin: number; costo: number } | null = null;

  for (;;) {
    let i = -1;
    for (let k = 0; k < nodos.length; k++) {
      const e = etiquetas[k];
      if (e && !cerrado[k] && (i < 0 || e.costo < etiquetas[i]!.costo)) i = k;
    }
    if (i < 0) break;
    const e = etiquetas[i]!;
    if (final && final.costo <= e.costo) break; // ya no se puede mejorar
    cerrado[i] = true;

    // Tramo final al destino
    if (restante[i]! <= alcance) {
      hayAlAlcance[i] = true;
      const carga = cargarEn(i, e, restante[i]!);
      if (carga) {
        cargaPosible[i] = true;
        const llegadaMin = carga.salidaMin + restante[i]! * ctx.minPorKm;
        const costo = e.costo + (llegadaMin - e.llegadaMin);
        if (!final || costo < final.costo) final = { previo: i, carga, llegadaMin, costo };
      }
    }
    // Tramos a cargadores que acercan al destino
    for (let j = 1; j < nodos.length; j++) {
      if (cerrado[j] || restante[j]! > restante[i]! - config.avanceMinimoKm) continue;
      const tramoKm = estimar(nodos[i]!.cargador.ubicacion, nodos[j]!.cargador.ubicacion);
      if (tramoKm > alcance) continue;
      hayAlAlcance[i] = true;
      const carga = cargarEn(i, e, tramoKm);
      if (!carga) continue;
      cargaPosible[i] = true;
      const llegadaMin = carga.salidaMin + tramoKm * ctx.minPorKm;
      const costo = e.costo + (llegadaMin - e.llegadaMin) + config.penalidadParadaMin;
      const actual = etiquetas[j];
      if (!actual || costo < actual.costo) {
        etiquetas[j] = {
          socLlegada: carga.objetivoPct - consumoPct(tramoKm),
          llegadaMin,
          costo,
          previo: i,
          tramoKm,
          tramoEstimado: true,
          cargaPrevia: carga,
        };
      }
    }
  }

  // --- Reconstrucción ---------------------------------------------------------------------------
  const aParada = (i: number, c: Carga): ParadaPlan => {
    const e = etiquetas[i]!;
    const desde = aFechaHora(c.inicioMin);
    const hasta = aFechaHora(c.salidaMin);
    return {
      cargador: nodos[i]!.cargador,
      kmEnRuta: r1(kmEnRuta(restante[i]!)),
      tramoKm: r1(e.tramoKm),
      tramoEstimado: e.tramoEstimado,
      socLlegadaPct: r1(e.socLlegada),
      objetivoPct: r1(c.objetivoPct),
      energiaKwh: r2(c.energiaKwh),
      cargaMin: r1(c.cargaMin),
      esperaMin: r1(c.esperaMin),
      esperaPorHorario: c.esperaPorHorario,
      esperaPorReserva: c.esperaPorReserva,
      costoEstimado: Math.round(c.costoEstimado),
      potenciaEfectivaKw: r2(c.potencia),
      horarioCarga: {
        fecha: desde.fecha,
        horaInicio: desde.hora,
        horaFin: hasta.fecha === desde.fecha ? hasta.hora : '23:59',
      },
    };
  };

  /** Paradas desde la primera hasta `ultimo`; la carga de `ultimo` es `cargaUltimo` (si la hay). */
  const camino = (ultimo: number, cargaUltimo: Carga | null): ParadaPlan[] => {
    const paradas: ParadaPlan[] = [];
    let carga = cargaUltimo;
    for (let i: number | null = ultimo; i !== null; i = etiquetas[i]!.previo) {
      if (carga) paradas.unshift(aParada(i, carga));
      carga = etiquetas[i]!.cargaPrevia;
    }
    return paradas;
  };

  const totales = (paradas: readonly ParadaPlan[], tramoFinalKm: number) => {
    const suma = (f: (p: ParadaPlan) => number) => paradas.reduce((a, p) => a + f(p), 0);
    const distanciaKm = suma((p) => p.tramoKm) + tramoFinalKm;
    // El primer tramo trae su duración real; los demás se estiman con la velocidad del trayecto directo.
    const viajeMin =
      inicio.viajeMin + (distanciaKm - (paradas[0]?.tramoKm ?? inicio.tramoKm)) * ctx.minPorKm;
    const esperaMin = suma((p) => p.esperaMin);
    const cargaMin = suma((p) => p.cargaMin);
    return {
      distanciaKm: r1(distanciaKm),
      viajeMin: r1(viajeMin),
      esperaMin: r1(esperaMin),
      cargaMin: r1(cargaMin),
      totalMin: r1(viajeMin + esperaMin + cargaMin),
      energiaKwh: r2(suma((p) => p.energiaKwh)),
      costoEstimado: suma((p) => p.costoEstimado),
    };
  };

  if (final) {
    const paradas = camino(final.previo, final.carga);
    const tramoFinal = restante[final.previo]!;
    const llegada = aFechaHora(final.llegadaMin);
    return {
      factible: true,
      paradas,
      llegada: {
        tramoKm: r1(tramoFinal),
        socPct: r1(final.carga.objetivoPct - consumoPct(tramoFinal)),
        fecha: llegada.fecha,
        hora: llegada.hora,
      },
      totales: totales(paradas, tramoFinal),
      problema: null,
    };
  }

  // Sin camino: se informa desde el punto más avanzado al que se llega.
  let f = 0;
  for (let k = 0; k < nodos.length; k++) {
    if (etiquetas[k] && restante[k]! < restante[f]!) f = k;
  }
  const nombre = nodos[f]!.cargador.nombre;
  const desdeKm = kmEnRuta(restante[f]!);
  const adelante = nodos
    .map((c, k) => ({ c, k }))
    .filter(({ k }) => k !== f && restante[k]! < restante[f]! - config.avanceMinimoKm)
    .sort(
      (a, b) =>
        estimar(nodos[f]!.cargador.ubicacion, a.c.cargador.ubicacion) -
        estimar(nodos[f]!.cargador.ubicacion, b.c.cargador.ubicacion),
    )[0];
  const siguienteKm = adelante ? kmEnRuta(restante[adelante.k]!) : null;
  const total = r0(ctx.distanciaTotalKm);
  let motivo: ProblemaViaje['motivo'];
  let mensaje: string;
  if (!hayAlAlcance[f]) {
    motivo = 'SIN_ALCANCE';
    mensaje =
      `Desde ${nombre} (km ${r0(desdeKm)} de ${total}) no hay cargadores compatibles a menos de ${r0(alcance)} km, lo máximo que recorre el vehículo con la batería llena. ` +
      (siguienteKm !== null
        ? `El siguiente cargador compatible sobre la ruta está en el km ${r0(siguienteKm)}.`
        : 'Más adelante no hay cargadores compatibles hasta el destino.');
  } else {
    motivo = 'SIN_DISPONIBILIDAD';
    mensaje = cargaPosible[f]
      ? `Desde ${nombre} (km ${r0(desdeKm)} de ${total}) los cargadores al alcance no están disponibles a la hora estimada de llegada.`
      : `${nombre} no está disponible para la carga necesaria a la hora estimada de llegada.`;
  }
  const paradas = camino(f, null);
  return {
    factible: false,
    paradas,
    llegada: null,
    totales: totales(paradas, 0),
    problema: {
      motivo,
      desdeNombre: nombre,
      desdeKm: r1(desdeKm),
      alcanceKm: r1(alcance),
      siguienteCargadorKm: siguienteKm === null ? null : r1(siguienteKm),
      mensaje,
    },
  };
}
