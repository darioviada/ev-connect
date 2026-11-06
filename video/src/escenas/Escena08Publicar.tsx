// Escena 8 — Publicar un cargador (guion 3:05–3:30). El anfitrión completa nombre y ubicación (búsqueda de
// dirección), conector, potencia y precio, y define días y horarios ("Mismo horario todos los días");
// toca "Publicar" y su cargador aparece activo en "Mis cargadores".
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { parpadeo, posicionCursor, tipeado, toque, ventana } from '../animacion/cursor';
import { entrada, tramo } from '../animacion/tiempo';
import { Cursor } from '../marco/Cursor';
import { Escenario } from '../marco/Escenario';
import { Navegacion } from '../marco/Navegacion';
import { Antetitulo, Linea, Titular } from '../marco/TextoSobreimpreso';
import {
  PantallaMisCargadores,
  PantallaPublicar,
  type CampoPublicar,
  type Franja,
  type LugarEncontrado,
} from '../pantallas/Publicar';

const NOMBRE = 'Cochera de Juan';
const BUSQUEDA = 'Av. Colón 4500';
const RESULTADOS: LugarEncontrado[] = [
  {
    nombre: 'Avenida Colón 4500',
    descripcion: 'Avenida Colón 4500, Alto Alberdi, Córdoba, Argentina',
    lat: -31.4071,
    lng: -64.2289,
  },
  {
    nombre: 'Avenida Colón 4500',
    descripcion: 'Avenida Colón 4500, Villa Carlos Paz, Córdoba, Argentina',
    lat: -31.4129,
    lng: -64.4951,
  },
];
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** Momentos (fracciones de la escena). */
const T = {
  nombre: 0.03,
  buscar: 0.11,
  enter: 0.19,
  elegir: 0.24,
  scroll1: [0.26, 0.3],
  conector: 0.31,
  tipo2: 0.35,
  potencia: 0.37,
  precio: 0.42,
  scroll2: [0.46, 0.5],
  desde: 0.52,
  hasta: 0.57,
  todosLosDias: 0.63,
  scroll3: [0.69, 0.77],
  publicar: 0.79,
  misCargadores: 0.85,
} as const;

/** Posiciones (área de contenido, sin desplazamiento), medidas con capturas de prueba. */
const POS = {
  nombre: { x: 250, y: 230 },
  buscar: { x: 200, y: 484 },
  botonBuscar: { x: 350, y: 484 },
  resultado: { x: 160, y: 589 },
  conector: { x: 250, y: 685 },
  opcionTipo2: { x: 120, y: 745 },
  potencia: { x: 250, y: 783 },
  precio: { x: 250, y: 882 },
  desde: { x: 100, y: 1150 },
  hasta: { x: 279, y: 1150 },
  todosLosDias: { x: 120, y: 1322 },
  publicar: { x: 195, y: 2920 },
} as const;
const SCROLL = { s1: 300, s2: 620, s3: 2320 } as const;

export function Escena08Publicar() {
  const frame = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();
  const ahora = frame / d;

  const desplazamiento =
    SCROLL.s1 * tramo(frame, d, T.scroll1[0], T.scroll1[1]) +
    (SCROLL.s2 - SCROLL.s1) * tramo(frame, d, T.scroll2[0], T.scroll2[1]) +
    (SCROLL.s3 - SCROLL.s2) * tramo(frame, d, T.scroll3[0], T.scroll3[1]);

  const enfocado: CampoPublicar =
    ahora >= T.publicar
      ? null
      : ahora >= T.hasta
        ? ahora < T.todosLosDias
          ? 'hasta'
          : null
        : ahora >= T.desde
          ? 'desde'
          : ahora >= T.precio && ahora < T.scroll2[0]
            ? 'precio'
            : ahora >= T.potencia && ahora < T.precio
              ? 'potencia'
              : ahora >= T.conector && ahora < T.potencia
                ? 'conector'
                : ahora >= T.buscar && ahora < T.elegir
                  ? 'buscarUbicacion'
                  : ahora >= T.nombre && ahora < T.buscar
                    ? 'nombre'
                    : null;

  const primera: Franja = {
    dia: 'Lunes',
    desde:
      ahora < T.desde + 0.01 ? '08:00' : tipeado('18:00', frame, d, T.desde + 0.01, T.desde + 0.04),
    hasta:
      ahora < T.hasta + 0.01 ? '20:00' : tipeado('23:00', frame, d, T.hasta + 0.01, T.hasta + 0.04),
  };
  const franjas: Franja[] =
    ahora >= T.todosLosDias + 0.01
      ? DIAS.map((dia) => ({ dia, desde: '18:00', hasta: '23:00' }))
      : [primera];

  const en = (p: { x: number; y: number }, s: number) => ({ x: p.x, y: p.y - s });
  const cursor = posicionCursor(frame, d, [
    { t: 0.01, x: 320, y: 560 },
    { t: T.nombre, ...POS.nombre },
    { t: T.buscar, ...POS.buscar },
    { t: T.enter, ...POS.botonBuscar },
    { t: T.elegir, ...POS.resultado },
    { t: T.conector, ...en(POS.conector, SCROLL.s1) },
    { t: T.tipo2, ...en(POS.opcionTipo2, SCROLL.s1) },
    { t: T.potencia, ...en(POS.potencia, SCROLL.s1) },
    { t: T.precio, ...en(POS.precio, SCROLL.s1) },
    { t: T.desde, ...en(POS.desde, SCROLL.s2) },
    { t: T.hasta, ...en(POS.hasta, SCROLL.s2) },
    { t: T.todosLosDias, ...en(POS.todosLosDias, SCROLL.s2) },
    { t: T.scroll3[1], x: 300, y: 560 },
    { t: T.publicar, ...en(POS.publicar, SCROLL.s3) },
  ]);
  const toques = Math.max(
    ...[
      T.nombre,
      T.buscar,
      T.enter,
      T.elegir,
      T.conector,
      T.tipo2,
      T.potencia,
      T.precio,
      T.desde,
      T.hasta,
      T.todosLosDias,
      T.publicar,
    ].map((t) => toque(frame, d, t)),
  );

  return (
    <Escenario
      textos={
        <>
          <div style={entrada(frame, d, 0.02, 0.08)}>
            <Antetitulo>Red colaborativa</Antetitulo>
          </div>
          <div style={entrada(frame, d, 0.04, 0.11, 32)}>
            <Titular>Tu cargador, disponible para otros conductores</Titular>
          </div>
          <div style={{ ...entrada(frame, d, 0.12, 0.18), marginTop: 10 }}>
            <Linea>Ubicación, conector, potencia, precio y horarios</Linea>
          </div>
          <div
            style={{
              ...entrada(frame, d, T.misCargadores + 0.02, T.misCargadores + 0.07),
              marginTop: 6,
            }}
          >
            <Linea style={{ color: 'var(--color-primario)', fontWeight: 600 }}>
              Desde ahora entra en las recomendaciones de otros conductores
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
                  <PantallaPublicar
                    nombre={tipeado(NOMBRE, frame, d, T.nombre + 0.01, T.buscar - 0.01)}
                    busqueda={
                      ahora >= T.elegir
                        ? ''
                        : tipeado(BUSQUEDA, frame, d, T.buscar + 0.01, T.enter - 0.01)
                    }
                    resultados={ahora >= T.enter + 0.02 && ahora < T.elegir ? RESULTADOS : null}
                    ubicacion={ahora >= T.elegir ? RESULTADOS[0]! : null}
                    conector="TIPO_2"
                    conectorDesplegado={ahora >= T.conector && ahora < T.tipo2 + 0.01}
                    potencia={tipeado('7.4', frame, d, T.potencia + 0.01, T.precio - 0.01)}
                    precio={tipeado('300', frame, d, T.precio + 0.01, T.scroll2[0] - 0.01)}
                    franjas={franjas}
                    entradaFranja={(i) =>
                      i === 0
                        ? {}
                        : entrada(
                            frame,
                            d,
                            T.todosLosDias + 0.01 + i * 0.008,
                            T.todosLosDias + 0.04 + i * 0.008,
                            14,
                          )
                    }
                    enfocado={enfocado}
                    caret={parpadeo(frame)}
                    enviando={ahora >= T.publicar + 0.01}
                    desplazamiento={desplazamiento}
                  />
                ),
              },
              {
                desde: T.misCargadores,
                contenido: (
                  <PantallaMisCargadores
                    nombre={NOMBRE}
                    conector="TIPO_2"
                    potenciaKw={7.4}
                    precioKwh={300}
                    franjas={7}
                    resaltado={ventana(frame, d, T.misCargadores + 0.03, 1, 8)}
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
              tramo(frame, d, 0.01, 0.03),
              1 - tramo(frame, d, T.misCargadores, T.misCargadores + 0.02),
            )}
          />
        </>
      }
    />
  );
}
