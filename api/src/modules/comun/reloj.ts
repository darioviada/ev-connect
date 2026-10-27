// Fecha y hora "de negocio" (zona horaria local) a partir de un reloj inyectable.
import { aFechaHora, aMinutosLocales } from '../../engine/tiempo.js';

export interface Reloj {
  ahora: () => Date;
  zonaHoraria: string;
}

export function momentoLocal(reloj: Reloj) {
  const minutos = aMinutosLocales(reloj.ahora(), reloj.zonaHoraria);
  const { fecha, hora } = aFechaHora(minutos);
  return { minutos, fecha, hora };
}

/** Fecha local 'YYYY-MM-DD' desplazada `dias` respecto de hoy. */
export function fechaRelativa(reloj: Reloj, dias: number): string {
  return aFechaHora(momentoLocal(reloj).minutos + dias * 24 * 60).fecha;
}
