// Recorrido del cursor: posiciones clave en fracciones de la escena; entre una y otra se interpola con
// aceleración suave. Las coordenadas son de la pantalla del celular (390 × 794 debajo de la barra de estado).
import { Easing, interpolate } from 'remotion';

export interface PuntoCursor {
  /** Fracción de la escena (0 a 1) en la que el cursor llega a este punto. */
  t: number;
  x: number;
  y: number;
}

const suave = Easing.bezier(0.45, 0, 0.2, 1);

export function posicionCursor(frame: number, duracion: number, puntos: readonly PuntoCursor[]) {
  const tiempos = puntos.map((p) => p.t * duracion);
  const opciones = {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: suave,
  } as const;
  // Por tramos, para que cada desplazamiento tenga su propia aceleración.
  let i = tiempos.findIndex((t) => frame < t);
  if (i === -1) i = puntos.length - 1;
  if (i === 0) return { x: puntos[0]!.x, y: puntos[0]!.y };
  const a = puntos[i - 1]!;
  const b = puntos[i]!;
  const rango = [tiempos[i - 1]!, tiempos[i]!];
  return {
    x: interpolate(frame, rango, [a.x, b.x], opciones),
    y: interpolate(frame, rango, [a.y, b.y], opciones),
  };
}

/** Intensidad (0 a 1) de un estado que dura entre dos fracciones, con subida y bajada cortas. */
export function ventana(frame: number, duracion: number, desde: number, hasta: number, rampa = 6) {
  const a = desde * duracion;
  const b = hasta * duracion;
  return interpolate(frame, [a, a + rampa, b - rampa, b], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}
