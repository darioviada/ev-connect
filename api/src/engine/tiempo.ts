// Tiempo en "minutos locales": minutos desde 1970-01-01 00:00 de la hora local (sin zona).
// Franjas y reservas están en hora local; convertir todo a esta escala permite compararlas con
// la hora de llegada sin errores de zona horaria. Funciones puras (Intl no hace I/O).
import type { DiaSemana } from './tipos.js';

const MINUTOS_POR_DIA = 24 * 60;

// Date.getUTCDay(): 0 = domingo
const DIAS_POR_INDICE: readonly DiaSemana[] = [
  'domingo',
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
];

const formateadores = new Map<string, Intl.DateTimeFormat>();
function formateador(zona: string): Intl.DateTimeFormat {
  let f = formateadores.get(zona);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: zona,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formateadores.set(zona, f);
  }
  return f;
}

/** Instante → minutos locales en la zona indicada. */
export function aMinutosLocales(instante: Date, zona: string): number {
  const p = Object.fromEntries(
    formateador(zona)
      .formatToParts(instante)
      .map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  const ms = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return ms / 60_000;
}

/** 'HH:MM' o 'HH:MM:SS' → minutos desde la medianoche. */
export function minutosDeHora(hora: string): number {
  const [h, m, s] = hora.split(':').map(Number) as [number, number, number?];
  return h * 60 + m + (s ?? 0) / 60;
}

/** Fecha 'YYYY-MM-DD' + hora → minutos locales. */
export function minutosLocales(fecha: string, hora: string): number {
  const [a, m, d] = fecha.split('-').map(Number) as [number, number, number];
  return Date.UTC(a, m - 1, d) / 60_000 + minutosDeHora(hora);
}

export function inicioDelDia(minutos: number): number {
  return Math.floor(minutos / MINUTOS_POR_DIA) * MINUTOS_POR_DIA;
}

export function diaDeLaSemana(minutos: number): DiaSemana {
  return DIAS_POR_INDICE[new Date(inicioDelDia(minutos) * 60_000).getUTCDay()]!;
}

/** Minutos locales → { fecha: 'YYYY-MM-DD', hora: 'HH:MM' } (redondeado al minuto). */
export function aFechaHora(minutos: number): { fecha: string; hora: string } {
  const iso = new Date(Math.round(minutos) * 60_000).toISOString();
  return { fecha: iso.slice(0, 10), hora: iso.slice(11, 16) };
}

export { MINUTOS_POR_DIA };
