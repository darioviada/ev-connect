// Escena 10 — Cierre (guion 3:45–4:00). Inicio en el celular, con la síntesis del proyecto, el título del
// TFG y los datos del autor; termina con "Gracias" y un fundido largo.
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { entrada, tramo } from '../animacion/tiempo';
import { PantallaApp } from '../app/PantallaApp';
import { CREDITOS } from '../config/escenas';
import { Fondo } from '../marco/Fondo';
import { Logo } from '../marco/Logo';
import { MarcoCelular } from '../marco/MarcoCelular';
import { Antetitulo, Linea, Titular } from '../marco/TextoSobreimpreso';
import { PantallaInicio } from '../pantallas/Inicio';

/** Fundido final (frames): el video termina en el color de fondo. */
const FUNDIDO_FINAL = 30;

export function Escena10Cierre() {
  const frame = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();

  const opacidad = interpolate(frame, [0, 8, d - FUNDIDO_FINAL, d], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const zoom = interpolate(frame, [0, d], [1.04, 1]);
  const gracias = tramo(frame, d, 0.72, 0.8);

  return (
    <AbsoluteFill style={{ background: 'var(--color-fondo)' }}>
      <AbsoluteFill style={{ opacity: opacidad }}>
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
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 26 }}>
              <div
                style={{
                  ...entrada(frame, d, 0.02, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  gap: 22,
                }}
              >
                <Logo tamano={72} />
                <span
                  style={{
                    fontFamily: 'var(--fuente-titulos)',
                    fontWeight: 700,
                    fontSize: 54,
                    color: 'var(--color-texto)',
                  }}
                >
                  {CREDITOS.producto}
                </span>
              </div>
              <div style={entrada(frame, d, 0.08, 0.16)}>
                <Linea style={{ fontSize: 32, color: 'var(--color-texto)' }}>
                  Motor de recomendación + red de carga colaborativa
                </Linea>
              </div>
              <div
                style={{
                  ...entrada(frame, d, 0.2, 0.28),
                  marginTop: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                <Antetitulo>
                  {CREDITOS.tipoTrabajo} · {CREDITOS.carrera}
                </Antetitulo>
                <Titular style={{ fontSize: 40 }}>{CREDITOS.titulo}</Titular>
              </div>
              <div
                style={{
                  ...entrada(frame, d, 0.32, 0.4),
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  marginTop: 10,
                  paddingLeft: 24,
                  borderLeft: '4px solid var(--color-primario)',
                }}
              >
                <Linea style={{ color: 'var(--color-texto)', fontWeight: 600, fontSize: 34 }}>
                  {CREDITOS.autor}
                </Linea>
                <Linea>
                  {CREDITOS.universidad} · {CREDITOS.anio}
                </Linea>
              </div>
              <div
                style={{
                  opacity: gracias,
                  transform: `translateY(${(1 - gracias) * 20}px)`,
                  marginTop: 18,
                  fontFamily: 'var(--fuente-titulos)',
                  fontWeight: 700,
                  fontSize: 48,
                  color: 'var(--color-primario)',
                }}
              >
                ¡Gracias!
              </div>
            </div>

            <MarcoCelular style={{ transform: `scale(${zoom})` }}>
              <PantallaInicio frame={frame} duracion={d} animarEntrada={false} />
            </MarcoCelular>
          </AbsoluteFill>
        </PantallaApp>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
