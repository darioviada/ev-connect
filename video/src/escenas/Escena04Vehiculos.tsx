// Escena 4 — Mis vehículos (guion 0:55–1:20). Lista → "+ Agregar" → elegir el modelo del catálogo → se
// completan batería, autonomía y conector → "Guardar vehículo" → detalle.
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { posicionCursor, toque, ventana } from '../animacion/cursor';
import { entrada, tramo } from '../animacion/tiempo';
import { DOLPHIN_MINI, E208 } from '../datos/vehiculos';
import { Cursor } from '../marco/Cursor';
import { Escenario } from '../marco/Escenario';
import { Navegacion } from '../marco/Navegacion';
import { Antetitulo, Linea, Titular } from '../marco/TextoSobreimpreso';
import {
  PantallaAgregarVehiculo,
  PantallaDetalleVehiculo,
  PantallaMisVehiculos,
  POS_VEHICULOS,
} from '../pantallas/Vehiculos';

/** Momentos (fracciones de la escena). */
const T = {
  agregar: 0.12,
  formulario: 0.15,
  abrirSelector: 0.25,
  elegir: 0.37,
  guardar: 0.6,
  detalle: 0.67,
} as const;

export function Escena04Vehiculos() {
  const frame = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();
  const ahora = frame / d;

  const elegido = ahora >= T.elegir ? DOLPHIN_MINI : null;
  const completado = tramo(frame, d, T.elegir + 0.02, T.elegir + 0.12);

  const P = POS_VEHICULOS;
  const cursor = posicionCursor(frame, d, [
    { t: 0.04, x: 300, y: 600 },
    { t: T.agregar, x: P.agregar.x, y: P.agregar.y },
    { t: T.abrirSelector, x: P.selector.x, y: P.selector.y },
    { t: T.elegir - 0.05, x: P.primeraOpcion.x + 120, y: P.primeraOpcion.y + 80 },
    { t: T.elegir, x: P.primeraOpcion.x, y: P.primeraOpcion.y },
    { t: T.guardar, x: P.guardar.x + 40, y: P.guardar.y },
  ]);
  const toques = Math.max(
    toque(frame, d, T.agregar),
    toque(frame, d, T.abrirSelector),
    toque(frame, d, T.elegir),
    toque(frame, d, T.guardar),
  );

  return (
    <Escenario
      textos={
        <>
          <div style={entrada(frame, d, 0.02, 0.08)}>
            <Antetitulo>Mis vehículos</Antetitulo>
          </div>
          <div style={entrada(frame, d, 0.04, 0.11, 32)}>
            <Titular>Elegís el modelo y los datos se completan solos</Titular>
          </div>
          <div style={{ ...entrada(frame, d, T.elegir + 0.04, T.elegir + 0.1), marginTop: 10 }}>
            <Linea>Batería, autonomía y conector: la base del motor de recomendación</Linea>
          </div>
        </>
      }
      celular={
        <>
          <Navegacion
            frame={frame}
            duracion={d}
            pantallas={[
              { desde: 0, contenido: <PantallaMisVehiculos vehiculos={[E208]} /> },
              {
                desde: T.formulario,
                contenido: (
                  <PantallaAgregarVehiculo
                    modelo={elegido}
                    desplegado={ahora >= T.abrirSelector && ahora < T.elegir + 0.01}
                    resaltado={ventana(frame, d, T.elegir - 0.02, 1) > 0 ? 0 : -1}
                    completado={completado}
                    enviando={ahora >= T.guardar + 0.01}
                  />
                ),
              },
              {
                desde: T.detalle,
                contenido: (
                  <PantallaDetalleVehiculo
                    v={DOLPHIN_MINI}
                    desplazamiento={170 * tramo(frame, d, T.detalle + 0.12, T.detalle + 0.2)}
                  />
                ),
              },
            ]}
          />
          <Cursor
            x={cursor.x}
            y={cursor.y}
            toque={toques}
            opacidad={Math.min(
              tramo(frame, d, 0.02, 0.05),
              1 - tramo(frame, d, T.detalle, T.detalle + 0.03),
            )}
          />
        </>
      }
    />
  );
}
