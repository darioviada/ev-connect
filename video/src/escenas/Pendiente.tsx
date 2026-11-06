// Marcador de una escena todavía no armada: muestra número, nombre y duración para revisar la línea de tiempo.
import { AbsoluteFill } from 'remotion';
import type { TramoEscena } from '../config/escenas';
import { FPS } from '../config/escenas';
import { Fondo } from '../marco/Fondo';
import { Antetitulo, Linea, Titular } from '../marco/TextoSobreimpreso';

const mmss = (frames: number) => {
  const s = Math.round(frames / FPS);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function Pendiente({ escena }: { escena: TramoEscena }) {
  return (
    <AbsoluteFill>
      <Fondo />
      <AbsoluteFill style={{ justifyContent: 'center', padding: '0 170px', gap: 24 }}>
        <Antetitulo>Escena {escena.numero} · pendiente</Antetitulo>
        <Titular>{escena.nombre}</Titular>
        <Linea>
          {mmss(escena.inicio)} a {mmss(escena.inicio + escena.duracion)} · frames {escena.inicio}–
          {escena.inicio + escena.duracion - 1}
        </Linea>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
