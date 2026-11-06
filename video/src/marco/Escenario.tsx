// Armado común de las escenas en celular: fondo, textos sobreimpresos a la izquierda y celular a la derecha,
// con el fundido de entrada y salida de la escena.
import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { fundidoEscena } from '../animacion/tiempo';
import { PantallaApp } from '../app/PantallaApp';
import { Fondo } from './Fondo';
import { MarcoCelular } from './MarcoCelular';

export function Escenario({
  textos,
  celular,
  estiloCelular,
}: {
  textos: ReactNode;
  celular: ReactNode;
  estiloCelular?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ opacity: fundidoEscena(frame, durationInFrames) }}>
      <Fondo />
      <PantallaApp>
        <AbsoluteFill
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: '0 150px 0 170px',
            gap: 120,
          }}
        >
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 22 }}>{textos}</div>
          <MarcoCelular style={estiloCelular}>{celular}</MarcoCelular>
        </AbsoluteFill>
      </PantallaApp>
    </AbsoluteFill>
  );
}
