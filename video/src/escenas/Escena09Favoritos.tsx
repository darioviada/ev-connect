// Escena 9 — Favoritos y escritorio (guion 3:30–3:45). En el celular se alterna entre "Cargadores" y
// "Rutas guardadas"; después, la misma app en una ventana de escritorio (diseño de escritorio real).
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { posicionCursor, toque } from '../animacion/cursor';
import { entrada, fundidoEscena, tramo } from '../animacion/tiempo';
import { PantallaApp } from '../app/PantallaApp';
import { CASA, RUTAS_GUARDADAS, TRABAJO } from '../datos/lugares';
import { DOLPHIN_MINI, E208 } from '../datos/vehiculos';
import { Cursor } from '../marco/Cursor';
import { Fondo } from '../marco/Fondo';
import { MarcoCelular } from '../marco/MarcoCelular';
import { Antetitulo, Titular } from '../marco/TextoSobreimpreso';
import { VentanaEscritorio } from '../marco/VentanaEscritorio';
import { PantallaFavoritos } from '../pantallas/Favoritos';
import { PantallaHome } from '../pantallas/Home';

/** Momentos (fracciones de la escena). */
const T = {
  rutas: 0.18,
  cargadores: 0.38,
  cambio: [0.5, 0.6],
  navFavoritos: 0.8,
} as const;

/** Pestañas en el área de contenido del celular. */
const PESTANA = { cargadores: { x: 110, y: 183 }, rutas: { x: 280, y: 183 } } as const;
/** Enlace "Favoritos" de la barra de escritorio (coordenadas dentro de la ventana). */
const NAV_FAVORITOS = { x: 556, y: 40 } as const;

export function Escena09Favoritos() {
  const frame = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();
  const ahora = frame / d;

  const pestana = ahora >= T.rutas && ahora < T.cargadores ? 'rutas' : 'cargadores';
  const cursorCel = posicionCursor(frame, d, [
    { t: 0.04, x: 300, y: 560 },
    { t: T.rutas, ...PESTANA.rutas },
    { t: T.cargadores, ...PESTANA.cargadores },
  ]);
  const cursorEsc = posicionCursor(frame, d, [
    { t: T.cambio[1], x: 900, y: 560 },
    { t: T.navFavoritos, ...NAV_FAVORITOS },
  ]);

  const salida = tramo(frame, d, T.cambio[0], T.cambio[0] + 0.06);
  const llegada = tramo(frame, d, T.cambio[0] + 0.03, T.cambio[1]);

  return (
    <AbsoluteFill style={{ opacity: fundidoEscena(frame, d) }}>
      <Fondo />
      <PantallaApp>
        {/* Parte 1: Favoritos en el celular */}
        <AbsoluteFill
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: '0 150px 0 170px',
            gap: 120,
            opacity: 1 - salida,
            transform: `scale(${1 - 0.05 * salida})`,
          }}
        >
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={entrada(frame, d, 0.02, 0.08)}>
              <Antetitulo>Favoritos</Antetitulo>
            </div>
            <div style={entrada(frame, d, 0.04, 0.12, 32)}>
              <Titular>Tus cargadores y rutas, a mano</Titular>
            </div>
          </div>
          <MarcoCelular>
            <PantallaFavoritos pestana={pestana} />
            <Cursor
              x={cursorCel.x}
              y={cursorCel.y}
              toque={Math.max(toque(frame, d, T.rutas), toque(frame, d, T.cargadores))}
              opacidad={tramo(frame, d, 0.02, 0.05)}
            />
          </MarcoCelular>
        </AbsoluteFill>

        {/* Parte 2: la misma app en escritorio */}
        <AbsoluteFill
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            gap: 26,
            opacity: llegada,
            transform: `scale(${interpolate(llegada, [0, 1], [0.94, 1])})`,
          }}
        >
          <Titular style={{ fontSize: 44, textAlign: 'center' }}>
            La misma app, en el celular y en el escritorio
          </Titular>
          <VentanaEscritorio style={{ zoom: 0.86 }}>
            <PantallaHome
              propios={[E208, DOLPHIN_MINI]}
              vehiculo={DOLPHIN_MINI}
              vehiculoDesplegado={false}
              vehiculoResaltado={null}
              modo="ruta"
              rutasGuardadas={RUTAS_GUARDADAS}
              rutaDesplegada={false}
              rutaResaltada={null}
              origen={CASA}
              destino={TRABAJO}
              bateriaPct={18}
              focoBateria={false}
              desplazamiento={0}
            />
            <Cursor
              x={cursorEsc.x}
              y={cursorEsc.y}
              opacidad={tramo(frame, d, T.cambio[1], T.cambio[1] + 0.03)}
            />
          </VentanaEscritorio>
        </AbsoluteFill>
      </PantallaApp>
    </AbsoluteFill>
  );
}
