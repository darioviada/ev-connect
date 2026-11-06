// Escena 7 — Detalle, reserva y seguimiento (guion 2:35–3:05). Datos del cargador (dirección, conector,
// potencia, costo estimado); se elige el horario y se toca "Confirmar reserva"; en "Mis reservas" se ven los
// estados y la reserva nueva pasa de Pendiente a Confirmada cuando el anfitrión la acepta (cargador privado).
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { Insignia } from '../../../web/src/components/ui';
import { posicionCursor, tipeado, toque, ventana } from '../animacion/cursor';
import { entrada, tramo } from '../animacion/tiempo';
import { WALLBOX_GARCIA } from '../datos/recomendaciones';
import { Cursor } from '../marco/Cursor';
import { Escenario } from '../marco/Escenario';
import { Navegacion } from '../marco/Navegacion';
import { Antetitulo, Linea, Titular } from '../marco/TextoSobreimpreso';
import {
  PantallaDetalleReserva,
  PantallaMisReservas,
  type EstadoFormulario,
  type ReservaVideo,
} from '../pantallas/Reserva';

/** Momentos (fracciones de la escena). */
const T = {
  datos: [
    [0.05, 0.11],
    [0.1, 0.15],
    [0.14, 0.19],
    [0.18, 0.24],
  ],
  scroll: [0.25, 0.31],
  desde: 0.33,
  hasta: 0.4,
  confirmar: 0.48,
  hecha: 0.53,
  verReservas: 0.59,
  reservas: 0.61,
  aceptada: 0.8,
} as const;

/** Posiciones en el área de contenido del celular (medidas con capturas de prueba). */
const POS = {
  desde: { x: 101, y: 1251 },
  hasta: { x: 287, y: 1251 },
  confirmar: { x: 194, y: 1402 },
  verReservas: { x: 194, y: 1111 },
} as const;
const SCROLL = 830;

const reservas = (aceptada: boolean): ReservaVideo[] => [
  {
    id: 'nueva',
    cargador: 'Wallbox García',
    cuando: 'Hoy, 08:30 a 09:05 hs',
    estado: aceptada ? 'confirmada' : 'pendiente',
  },
  { id: 'cm', cargador: 'Cochera Medina', cuando: '08/11, 10:00 a 11:00 hs', estado: 'pendiente' },
  { id: 'sn', cargador: 'Shopping Norte', cuando: '02/11, 19:00 a 20:00 hs', estado: 'cancelada' },
];

export function Escena07Reserva() {
  const frame = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();
  const ahora = frame / d;

  const desplazamiento = SCROLL * tramo(frame, d, T.scroll[0], T.scroll[1]);
  // Al tocar un campo se reescribe la hora (el valor precargado se reemplaza).
  const desde =
    ahora < T.desde + 0.01 ? '08:15' : tipeado('08:30', frame, d, T.desde + 0.01, T.desde + 0.05);
  const hasta =
    ahora < T.hasta + 0.01 ? '08:50' : tipeado('09:05', frame, d, T.hasta + 0.01, T.hasta + 0.05);
  const estado: EstadoFormulario =
    ahora >= T.hecha ? 'hecha' : ahora >= T.confirmar + 0.01 ? 'enviando' : 'editando';
  const enfocado =
    ahora >= T.desde && ahora < T.hasta
      ? 'desde'
      : ahora >= T.hasta && ahora < T.confirmar
        ? 'hasta'
        : null;

  const enPantalla = (p: { x: number; y: number }) => ({ x: p.x, y: p.y - SCROLL });
  const cursor = posicionCursor(frame, d, [
    { t: 0.24, x: 330, y: 520 },
    { t: T.desde, ...enPantalla(POS.desde) },
    { t: T.hasta, ...enPantalla(POS.hasta) },
    { t: T.confirmar, ...enPantalla(POS.confirmar) },
    { t: T.verReservas, ...enPantalla(POS.verReservas) },
  ]);
  const toques = Math.max(
    toque(frame, d, T.desde),
    toque(frame, d, T.hasta),
    toque(frame, d, T.confirmar),
    toque(frame, d, T.verReservas),
  );

  const aceptada = ahora >= T.aceptada;

  return (
    <Escenario
      textos={
        <>
          <div style={entrada(frame, d, 0.02, 0.08)}>
            <Antetitulo>Reservas</Antetitulo>
          </div>
          <div style={entrada(frame, d, 0.04, 0.11, 32)}>
            <Titular>Reservás un horario y seguís su estado</Titular>
          </div>
          <div
            style={{
              ...entrada(frame, d, T.reservas + 0.04, T.reservas + 0.1),
              display: 'flex',
              gap: 18,
              marginTop: 14,
              transformOrigin: 'left center',
            }}
          >
            <div style={{ display: 'flex', gap: 14, zoom: 1.7 }}>
              <Insignia tono="exito">Confirmada</Insignia>
              <Insignia tono="pendiente">Pendiente</Insignia>
              <Insignia tono="atenuado">Cancelada</Insignia>
            </div>
          </div>
          <div style={{ ...entrada(frame, d, T.aceptada, T.aceptada + 0.05), marginTop: 10 }}>
            <Linea>
              En un cargador privado, la reserva se confirma cuando el anfitrión la acepta
            </Linea>
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
                  <PantallaDetalleReserva
                    rec={WALLBOX_GARCIA}
                    resaltados={{
                      direccion: ventana(frame, d, T.datos[0]![0], T.datos[0]![1], 5),
                      conector: ventana(frame, d, T.datos[1]![0], T.datos[1]![1], 5),
                      potencia: ventana(frame, d, T.datos[2]![0], T.datos[2]![1], 5),
                      costo: ventana(frame, d, T.datos[3]![0], T.datos[3]![1], 5),
                    }}
                    desplazamiento={desplazamiento}
                    desde={desde}
                    hasta={hasta}
                    enfocado={enfocado}
                    estado={estado}
                  />
                ),
              },
              {
                desde: T.reservas,
                contenido: (
                  <PantallaMisReservas
                    reservas={reservas(aceptada)}
                    entrada={(i) =>
                      entrada(
                        frame,
                        d,
                        T.reservas + 0.02 + i * 0.03,
                        T.reservas + 0.07 + i * 0.03,
                        30,
                      )
                    }
                    resaltada={ventana(frame, d, T.aceptada - 0.02, T.aceptada + 0.12, 8)}
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
              tramo(frame, d, 0.22, 0.25),
              1 - tramo(frame, d, T.reservas, T.reservas + 0.02),
            )}
          />
        </>
      }
    />
  );
}
