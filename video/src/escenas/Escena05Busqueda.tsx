// Escena 5 — Búsqueda (guion 1:20–2:00). Elegir el Dolphin Mini y ver su ficha; cambiar de Ubicación a
// Ruta; cargar Casa → Trabajo (ruta guardada); bajar la batería (la urgencia pasa sola a Alta); tocar
// "Buscar cargadores". La pantalla se desplaza como al hacer scroll en el celular.
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { posicionCursor, toque } from '../animacion/cursor';
import { entrada, tramo } from '../animacion/tiempo';
import { CASA, RUTAS_GUARDADAS, TRABAJO } from '../datos/lugares';
import { DOLPHIN_MINI, E208 } from '../datos/vehiculos';
import { Cursor } from '../marco/Cursor';
import { Escenario } from '../marco/Escenario';
import { Antetitulo, Linea, Titular } from '../marco/TextoSobreimpreso';
import { opcionVehiculoPropio, PantallaHome } from '../pantallas/Home';

/** Momentos (fracciones de la escena). */
const T = {
  abrirVehiculo: 0.06,
  elegirVehiculo: 0.13,
  scroll1: [0.22, 0.27],
  ruta: 0.31,
  abrirRuta: 0.38,
  elegirRuta: 0.45,
  scroll2: [0.5, 0.56],
  bateria: [0.6, 0.73],
  scroll3: [0.8, 0.84],
  buscar: 0.89,
} as const;

/** Batería inicial y final del control. */
const BATERIA = { desde: 80, hasta: 18 } as const;

/**
 * Posiciones en el área de contenido del celular (sin desplazamiento), medidas con capturas de prueba.
 * Al hacer scroll, la posición en pantalla es y − desplazamiento.
 */
const POS = {
  selectorVehiculo: { x: 250, y: 302 },
  opcionDolphin: { x: 154, y: 435 },
  segmentoRuta: { x: 287, y: 769 },
  selectorRuta: { x: 250, y: 867 },
  opcionCasaTrabajo: { x: 140, y: 926 },
  sliderY: 1282,
  sliderX: (pct: number) => 20 + (354 * pct) / 100,
  buscar: { x: 195, y: 1516 },
} as const;

const SCROLL = { s1: 360, s2: 780, s3: 900 } as const;

export function Escena05Busqueda() {
  const frame = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();
  const ahora = frame / d;

  const desplazamiento =
    SCROLL.s1 * tramo(frame, d, T.scroll1[0], T.scroll1[1]) +
    (SCROLL.s2 - SCROLL.s1) * tramo(frame, d, T.scroll2[0], T.scroll2[1]) +
    (SCROLL.s3 - SCROLL.s2) * tramo(frame, d, T.scroll3[0], T.scroll3[1]);
  const bateriaPct = Math.round(
    interpolate(
      tramo(frame, d, T.bateria[0], T.bateria[1]),
      [0, 1],
      [BATERIA.desde, BATERIA.hasta],
    ),
  );

  const vehiculo = ahora >= T.elegirVehiculo ? DOLPHIN_MINI : E208;
  const enPantalla = (p: { x: number; y: number }, scroll: number) => ({ x: p.x, y: p.y - scroll });

  const cursor = posicionCursor(frame, d, [
    { t: 0.03, x: 320, y: 560 },
    { t: T.abrirVehiculo, ...enPantalla(POS.selectorVehiculo, 0) },
    { t: T.elegirVehiculo, ...enPantalla(POS.opcionDolphin, 0) },
    { t: T.scroll1[0], x: 330, y: 520 },
    { t: T.ruta, ...enPantalla(POS.segmentoRuta, SCROLL.s1) },
    { t: T.abrirRuta, ...enPantalla(POS.selectorRuta, SCROLL.s1) },
    { t: T.elegirRuta, ...enPantalla(POS.opcionCasaTrabajo, SCROLL.s1) },
    { t: T.scroll2[1] + 0.02, x: POS.sliderX(BATERIA.desde), y: POS.sliderY - SCROLL.s2 },
    { t: T.bateria[0], x: POS.sliderX(BATERIA.desde), y: POS.sliderY - SCROLL.s2 },
    { t: T.bateria[1], x: POS.sliderX(BATERIA.hasta), y: POS.sliderY - SCROLL.s2 },
    { t: T.scroll3[0], x: POS.sliderX(BATERIA.hasta), y: POS.sliderY - SCROLL.s2 },
    { t: T.buscar, ...enPantalla(POS.buscar, SCROLL.s3) },
  ]);
  const toques = Math.max(
    toque(frame, d, T.abrirVehiculo),
    toque(frame, d, T.elegirVehiculo),
    toque(frame, d, T.ruta),
    toque(frame, d, T.abrirRuta),
    toque(frame, d, T.elegirRuta),
    toque(frame, d, T.bateria[0] - 0.01),
    toque(frame, d, T.buscar),
  );
  // Mientras se arrastra el control, el cursor queda "apretado".
  const arrastrando = ahora >= T.bateria[0] && ahora <= T.bateria[1];

  return (
    <Escenario
      textos={
        <>
          <div style={entrada(frame, d, 0.02, 0.08)}>
            <Antetitulo>Búsqueda contextual</Antetitulo>
          </div>
          <div style={entrada(frame, d, 0.04, 0.11, 32)}>
            <Titular>Tu vehículo, tu recorrido y tu batería</Titular>
          </div>
          <div
            style={{
              ...entrada(frame, d, T.bateria[0] + 0.08, T.bateria[0] + 0.14),
              marginTop: 10,
            }}
          >
            <Linea>
              Con poca batería la urgencia pasa a{' '}
              <strong style={{ color: 'var(--color-primario)' }}>Alta</strong>: se priorizan
              cargadores cercanos y disponibles ya
            </Linea>
          </div>
        </>
      }
      celular={
        <>
          <PantallaHome
            propios={[E208, DOLPHIN_MINI]}
            vehiculo={vehiculo}
            vehiculoDesplegado={ahora >= T.abrirVehiculo && ahora < T.elegirVehiculo + 0.01}
            vehiculoResaltado={
              ahora >= T.elegirVehiculo - 0.02
                ? opcionVehiculoPropio(DOLPHIN_MINI)
                : opcionVehiculoPropio(E208)
            }
            modo={ahora >= T.ruta ? 'ruta' : 'ubicacion'}
            rutasGuardadas={RUTAS_GUARDADAS}
            rutaDesplegada={ahora >= T.abrirRuta && ahora < T.elegirRuta + 0.01}
            rutaResaltada={ahora >= T.elegirRuta - 0.02 ? RUTAS_GUARDADAS[0]! : null}
            origen={ahora >= T.elegirRuta ? CASA : null}
            destino={ahora >= T.elegirRuta ? TRABAJO : null}
            bateriaPct={bateriaPct}
            focoBateria={ahora >= T.bateria[0] - 0.02 && ahora <= T.scroll3[0]}
            desplazamiento={desplazamiento}
          />
          <Cursor
            x={cursor.x}
            y={cursor.y}
            toque={arrastrando ? 0.25 : toques}
            opacidad={Math.min(tramo(frame, d, 0.01, 0.04), 1 - tramo(frame, d, 0.94, 0.97))}
          />
        </>
      }
    />
  );
}
