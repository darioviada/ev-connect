// Formato de valores para la interfaz (es-AR).

const CONECTORES: Record<string, string> = {
  TIPO_2: 'Tipo 2',
  CCS_COMBO: 'CCS Combo',
  CHADEMO: 'CHAdeMO',
};
export const nombreConector = (c: string) => CONECTORES[c] ?? c;
export const CONECTORES_OPCIONES = Object.entries(CONECTORES).map(([valor, nombre]) => ({
  valor,
  nombre,
}));

const DIAS: Record<string, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
};
export const nombreDia = (d: string) => DIAS[d] ?? d;
export const DIAS_OPCIONES = Object.entries(DIAS).map(([valor, nombre]) => ({ valor, nombre }));

const numero = (decimales: number) =>
  new Intl.NumberFormat('es-AR', { maximumFractionDigits: decimales });

export const km = (x: number) => `${numero(1).format(x)} km`;
export const kw = (x: number) => `${numero(1).format(x)} kW`;
export const kwh = (x: number) => `${numero(1).format(x)} kWh`;
export const pesos = (x: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(x);

export function minutos(x: number): string {
  const m = Math.round(x);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const resto = m % 60;
  return resto === 0 ? `${h} h` : `${h} h ${resto} min`;
}

export const disponibilidad = (esperaMin: number) =>
  esperaMin < 1 ? 'Libre ahora' : `Libre en ${minutos(esperaMin)}`;

/** 'YYYY-MM-DD' → "Hoy", "Mañana" o "dd/mm" (respecto de `hoy`). */
export function fechaCorta(fecha: string, hoy = fechaLocal()): string {
  if (fecha === hoy) return 'Hoy';
  if (fecha === sumarDias(hoy, 1)) return 'Mañana';
  const [, m, d] = fecha.split('-');
  return `${d}/${m}`;
}

/** Fecha local del navegador 'YYYY-MM-DD'. */
export function fechaLocal(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split('-').map(Number) as [number, number, number];
  const f = new Date(Date.UTC(a, m - 1, d + dias));
  return f.toISOString().slice(0, 10);
}

export const ESTADOS_RESERVA: Record<string, string> = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
};

const ORDEN_DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

/** Agrupa franjas con el mismo horario: "Todos los días", "Lunes a viernes", "Fines de semana" o la lista. */
export function agruparFranjas(
  franjas: { dia: string; horaInicio: string; horaFin: string }[],
): { dias: string; horario: string }[] {
  const grupos = new Map<string, string[]>();
  for (const f of franjas) {
    const clave = `${f.horaInicio} a ${f.horaFin}`;
    grupos.set(clave, [...(grupos.get(clave) ?? []), f.dia]);
  }
  return [...grupos].map(([horario, dias]) => {
    const unicos = ORDEN_DIAS.filter((d) => dias.includes(d));
    const es = (lista: string[]) =>
      unicos.length === lista.length && lista.every((d) => unicos.includes(d));
    const nombre = es(ORDEN_DIAS)
      ? 'Todos los días'
      : es(ORDEN_DIAS.slice(0, 5))
        ? 'Lunes a viernes'
        : es(ORDEN_DIAS.slice(5))
          ? 'Fines de semana'
          : unicos.map(nombreDia).join(', ');
    return { dias: nombre, horario };
  });
}
