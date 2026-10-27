// Fechas de calendario como texto 'YYYY-MM-DD' (sin horas ni zonas, para evitar corrimientos).

export type DiaSemana =
  'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo';

export const DIAS_SEMANA: readonly DiaSemana[] = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
];

// Date.getUTCDay(): 0 = domingo
const POR_INDICE_JS: readonly DiaSemana[] = [
  'domingo',
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
];

/** Fecha de hoy en la zona horaria indicada (por defecto, la de negocio). */
export function hoyEnZona(zona: string, ahora = new Date()): string {
  // en-CA formatea como YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}

function aUtc(fecha: string): Date {
  const [a, m, d] = fecha.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d));
}

export function sumarDias(fecha: string, dias: number): string {
  const f = aUtc(fecha);
  f.setUTCDate(f.getUTCDate() + dias);
  return f.toISOString().slice(0, 10);
}

export function diaDeLaSemana(fecha: string): DiaSemana {
  return POR_INDICE_JS[aUtc(fecha).getUTCDay()]!;
}
