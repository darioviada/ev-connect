// Utilidades de animación. Todo se expresa como fracción de la duración de la escena (0 a 1), así las
// animaciones se adaptan cuando cambia la duración en config/escenas.ts.
import { Easing, interpolate } from 'remotion';

const suave = Easing.bezier(0.16, 1, 0.3, 1);

/** Progreso de 0 a 1 entre dos fracciones de la escena (con aceleración suave). */
export function tramo(frame: number, duracion: number, desde: number, hasta: number): number {
  return interpolate(frame, [desde * duracion, hasta * duracion], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: suave,
  });
}

/** Estilo de entrada (aparece y sube) para un elemento, entre dos fracciones de la escena. */
export function entrada(
  frame: number,
  duracion: number,
  desde: number,
  hasta: number,
  distancia = 24,
): { opacity: number; transform: string } {
  const p = tramo(frame, duracion, desde, hasta);
  return { opacity: p, transform: `translateY(${(1 - p) * distancia}px)` };
}

/** Opacidad de la escena: fundido corto al entrar y al salir (en frames). */
export function fundidoEscena(frame: number, duracion: number, frames = 8): number {
  return interpolate(frame, [0, frames, duracion - frames, duracion], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}
