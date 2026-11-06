// Escena 6 — Recomendaciones y mapa (guion 2:00–2:35). Las tarjetas entran ordenadas por puntaje; se destaca
// "Mejor opción" (Wallbox García) y se compara con Estación de servicio Ruta 9 y Shopping Norte; después,
// la vista de mapa con el recorrido Casa → Trabajo y los tres cargadores sobre él.
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { posicionCursor, toque, ventana } from '../animacion/cursor';
import { entrada, tramo } from '../animacion/tiempo';
import { RECOMENDACIONES } from '../datos/recomendaciones';
import { Cursor } from '../marco/Cursor';
import { Escenario } from '../marco/Escenario';
import { Navegacion } from '../marco/Navegacion';
import { Antetitulo, Linea, Titular } from '../marco/TextoSobreimpreso';
import type { PinMapa } from '../pantallas/MapaEstilizado';
import { PantallaResultadosLista, PantallaResultadosMapa } from '../pantallas/Resultados';

/** Momentos (fracciones de la escena). */
const T = {
  tarjetas: [0.03, 0.07, 0.11],
  mejor: [0.17, 0.37],
  comparar: [
    [0.38, 0.45],
    [0.45, 0.52],
  ],
  mapa: 0.55,
  vistaMapa: 0.57,
  trazo: [0.6, 0.7],
  pines: [0.68, 0.72, 0.77],
} as const;

/** Posiciones en el área de contenido del celular (medidas con capturas de prueba). */
const POS = {
  insigniaMejor: { x: 290, y: 324 },
  /** Centro de cada tarjeta sin desplazamiento. */
  tarjeta: [382, 587, 789] as const,
  botonMapa: { x: 350, y: 130 },
} as const;

/** Desplazamiento de la lista para ver la tercera tarjeta. */
const SCROLL = 230;

/** Ubicación de los pines en el mapa estilizado (sobre el recorrido). */
const PINES = [
  { id: 'wallbox-garcia', x: 122, y: 136, destacado: true },
  { id: 'estacion-ruta-9', x: 302, y: 220, destacado: false },
  { id: 'shopping-norte', x: 196, y: 168, destacado: false },
] as const;

export function Escena06Recomendaciones() {
  const frame = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();
  const ahora = frame / d;

  const cursor = posicionCursor(frame, d, [
    { t: 0.12, x: 330, y: 640 },
    { t: T.mejor[0] + 0.02, ...POS.insigniaMejor },
    { t: T.comparar[0]![0] + 0.02, x: 300, y: POS.tarjeta[1] },
    { t: T.comparar[1]![0] + 0.03, x: 300, y: POS.tarjeta[2] - SCROLL },
    { t: T.comparar[1]![1], x: 300, y: POS.tarjeta[2] - SCROLL },
    { t: T.mapa, ...POS.botonMapa },
  ]);

  // Orden de aparición de los pines: primero las alternativas, al final la mejor opción.
  const ordenPines = [2, 0, 1];
  const pines: PinMapa[] = PINES.map((p, i) => ({
    ...p,
    aparicion: tramo(frame, d, T.pines[ordenPines[i]!]!, T.pines[ordenPines[i]!]! + 0.04),
    pulso: p.destacado && ahora > 0.82 ? ((frame - 0.82 * d) % 45) / 45 : 0,
  }));

  const enMapa = ahora >= T.vistaMapa;

  return (
    <Escenario
      textos={
        <>
          <div style={entrada(frame, d, 0.02, 0.08)}>
            <Antetitulo>Motor de recomendación</Antetitulo>
          </div>
          <div style={entrada(frame, d, 0.04, 0.11, 32)}>
            <Titular>Cada cargador, evaluado y ordenado</Titular>
          </div>
          <div style={{ position: 'relative', marginTop: 10, minHeight: 90 }}>
            <div
              style={{
                ...entrada(frame, d, 0.12, 0.18),
                opacity:
                  tramo(frame, d, 0.12, 0.18) * (1 - tramo(frame, d, T.mapa, T.vistaMapa + 0.02)),
                position: 'absolute',
                inset: 0,
              }}
            >
              <Linea>
                Distancia, disponibilidad, tiempo de carga y costo, ponderados según tu urgencia
              </Linea>
            </div>
            <div
              style={{
                ...entrada(frame, d, T.trazo[0], T.trazo[0] + 0.06),
                position: 'absolute',
                inset: 0,
              }}
            >
              <Linea>Las alternativas, ubicadas sobre tu recorrido</Linea>
            </div>
          </div>
        </>
      }
      celular={
        <>
          <Navegacion
            frame={frame}
            duracion={d}
            pantallas={[
              {
                desde: 0,
                contenido: (
                  <PantallaResultadosLista
                    recomendaciones={RECOMENDACIONES}
                    entrada={(i) => entrada(frame, d, T.tarjetas[i]!, T.tarjetas[i]! + 0.06, 40)}
                    resaltado={(i) =>
                      i === 0
                        ? ventana(frame, d, T.mejor[0], T.mejor[1], 8)
                        : ventana(frame, d, T.comparar[i - 1]![0], T.comparar[i - 1]![1], 6)
                    }
                    hoverMapa={ventana(frame, d, T.mapa - 0.02, T.vistaMapa, 4)}
                    desplazamiento={
                      SCROLL *
                      (tramo(frame, d, T.comparar[1]![0], T.comparar[1]![0] + 0.03) -
                        tramo(frame, d, T.comparar[1]![1], T.comparar[1]![1] + 0.02))
                    }
                  />
                ),
              },
              {
                desde: T.vistaMapa,
                contenido: (
                  <PantallaResultadosMapa
                    recomendaciones={RECOMENDACIONES}
                    trazo={tramo(frame, d, T.trazo[0], T.trazo[1])}
                    pines={pines}
                  />
                ),
              },
            ]}
          />
          <Cursor
            x={cursor.x}
            y={cursor.y}
            toque={toque(frame, d, T.mapa)}
            opacidad={Math.min(tramo(frame, d, 0.12, 0.15), enMapa ? 0 : 1)}
          />
        </>
      }
    />
  );
}
