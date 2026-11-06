// Cambio entre pantallas de la app como en un celular: la nueva entra desde la derecha y la anterior se
// corre un poco hacia la izquierda. Cada pantalla empieza en una fracción de la escena.
import type { ReactNode } from 'react';
import { AbsoluteFill, Easing, interpolate } from 'remotion';

export interface PantallaEnEscena {
  /** Fracción de la escena (0 a 1) en la que esta pantalla empieza a entrar. */
  desde: number;
  contenido: ReactNode;
}

const DURACION_CAMBIO = 14;

export function Navegacion({
  frame,
  duracion,
  pantallas,
}: {
  frame: number;
  duracion: number;
  pantallas: readonly PantallaEnEscena[];
}) {
  let i = 0;
  pantallas.forEach((p, k) => {
    if (frame >= p.desde * duracion) i = k;
  });
  const inicio = pantallas[i]!.desde * duracion;
  const avance =
    i === 0
      ? 1
      : interpolate(frame, [inicio, inicio + DURACION_CAMBIO], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.bezier(0.2, 0.8, 0.2, 1),
        });

  return (
    <AbsoluteFill>
      {avance < 1 && i > 0 && (
        <AbsoluteFill
          style={{ transform: `translateX(${-25 * avance}%)`, opacity: 1 - 0.3 * avance }}
        >
          {pantallas[i - 1]!.contenido}
        </AbsoluteFill>
      )}
      <AbsoluteFill
        style={{
          transform: `translateX(${(1 - avance) * 100}%)`,
          background: 'var(--color-superficie)',
          boxShadow: avance < 1 ? '-8px 0 24px rgb(27 29 26 / 0.12)' : 'none',
        }}
      >
        {pantallas[i]!.contenido}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
