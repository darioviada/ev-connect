// Escena 1 — Apertura (guion 0:00–0:20). Plano fijo de la pantalla de Inicio en el celular; aparecen el
// título del TFG y el autor como texto sobreimpreso.
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { entrada, fundidoEscena, tramo } from '../animacion/tiempo';
import { PantallaApp } from '../app/PantallaApp';
import { CREDITOS } from '../config/escenas';
import { Fondo } from '../marco/Fondo';
import { MarcoCelular } from '../marco/MarcoCelular';
import { Antetitulo, Linea, Titular } from '../marco/TextoSobreimpreso';
import { PantallaInicio } from '../pantallas/Inicio';

export function Escena01Apertura() {
  const frame = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();

  // El celular entra desde abajo y se acerca muy despacio durante toda la escena.
  const llegada = tramo(frame, d, 0, 0.08);
  const zoom = interpolate(frame, [0, d], [1, 1.04]);

  return (
    <AbsoluteFill style={{ opacity: fundidoEscena(frame, d) }}>
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
          {/* Textos sobreimpresos */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 34 }}>
            <div style={entrada(frame, d, 0.18, 0.24)}>
              <Antetitulo>
                {CREDITOS.tipoTrabajo} · {CREDITOS.carrera}
              </Antetitulo>
            </div>
            <div style={entrada(frame, d, 0.22, 0.3, 32)}>
              <Titular>{CREDITOS.titulo}</Titular>
            </div>
            <div
              style={{
                ...entrada(frame, d, 0.32, 0.38),
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                marginTop: 18,
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
          </div>

          {/* Celular con la pantalla de Inicio */}
          <MarcoCelular
            style={{
              opacity: llegada,
              transform: `translateY(${(1 - llegada) * 80}px) scale(${zoom})`,
            }}
          >
            <PantallaInicio frame={frame} duracion={d} />
          </MarcoCelular>
        </AbsoluteFill>
      </PantallaApp>
    </AbsoluteFill>
  );
}
