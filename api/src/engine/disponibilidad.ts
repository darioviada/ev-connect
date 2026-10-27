// §6.4 — Disponibilidad en la ventana [inicio, inicio + carga], en minutos locales.
// - Sin franjas = 24/7. La ventana completa debe caber dentro de una franja; si no, se espera a la
//   próxima franja donde quepa.
// - Si la ventana se solapa con una reserva activa, se espera a que termine (y se vuelve a verificar).
// - La espera total (por horario + por reservas) no puede superar `esperaMaximaMin`; si no, se descarta.
import {
  diaDeLaSemana,
  inicioDelDia,
  minutosDeHora,
  minutosLocales,
  MINUTOS_POR_DIA,
} from './tiempo.js';
import type { FranjaMotor, ReservaMotor } from './tipos.js';

export type ResultadoDisponibilidad =
  | {
      disponible: true;
      inicioMin: number;
      esperaMin: number;
      esperaPorHorario: boolean;
      esperaPorReserva: boolean;
    }
  | { disponible: false; detalle: string };

/** Primer inicio s ≥ desde (y ≤ limite) tal que [s, s + duracion] cabe en una franja; null si no hay. */
export function proximoInicioEnHorario(
  desde: number,
  duracion: number,
  franjas: readonly FranjaMotor[],
  limite: number,
): number | null {
  if (franjas.length === 0) return desde;
  let mejor: number | null = null;
  for (let dia = inicioDelDia(desde); dia <= limite; dia += MINUTOS_POR_DIA) {
    const nombreDia = diaDeLaSemana(dia);
    for (const f of franjas) {
      if (f.dia !== nombreDia) continue;
      const apertura = dia + minutosDeHora(f.inicio);
      const cierre = dia + minutosDeHora(f.fin);
      const s = Math.max(desde, apertura);
      if (s + duracion <= cierre && s <= limite && (mejor === null || s < mejor)) mejor = s;
    }
  }
  return mejor;
}

export function evaluarDisponibilidad(params: {
  llegadaMin: number;
  duracionMin: number;
  franjas: readonly FranjaMotor[];
  reservas: readonly ReservaMotor[];
  esperaMaximaMin: number;
}): ResultadoDisponibilidad {
  const { llegadaMin, duracionMin, franjas, esperaMaximaMin } = params;
  const ocupaciones = params.reservas.map((r) => ({
    desde: minutosLocales(r.fecha, r.horaInicio),
    hasta: minutosLocales(r.fecha, r.horaFin),
  }));
  const limite = llegadaMin + esperaMaximaMin;
  let inicio = llegadaMin;
  let esperaPorHorario = false;
  let esperaPorReserva = false;

  // Cada vuelta avanza el inicio; el límite de vueltas es solo una protección.
  for (let vuelta = 0; vuelta < 100; vuelta++) {
    const enHorario = proximoInicioEnHorario(inicio, duracionMin, franjas, limite);
    if (enHorario === null) {
      return {
        disponible: false,
        detalle: esperaPorReserva
          ? `Ocupado por reservas y fuera de horario en las próximas ${esperaMaximaMin / 60} h.`
          : `La carga no entra en el horario de disponibilidad de las próximas ${esperaMaximaMin / 60} h.`,
      };
    }
    if (enHorario > inicio) esperaPorHorario = true;
    inicio = enHorario;

    const fin = inicio + duracionMin;
    const choques = ocupaciones.filter((o) => o.desde < fin && inicio < o.hasta);
    if (choques.length === 0) {
      return {
        disponible: true,
        inicioMin: inicio,
        esperaMin: inicio - llegadaMin,
        esperaPorHorario,
        esperaPorReserva,
      };
    }
    esperaPorReserva = true;
    inicio = Math.max(...choques.map((o) => o.hasta));
    if (inicio > limite) {
      return {
        disponible: false,
        detalle: `Ocupado por reservas durante más de ${esperaMaximaMin / 60} h desde la llegada.`,
      };
    }
  }
  return { disponible: false, detalle: 'No se encontró un horario libre.' };
}
