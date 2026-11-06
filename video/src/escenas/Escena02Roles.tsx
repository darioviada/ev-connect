// Escena 2 — Roles (guion 0:20–0:40). Inicio con el cursor pasando sobre ambos botones; los tres roles se
// sobreimprimen a medida que la locución los nombra: invitado → "Continuar como invitado"; conductor y
// anfitrión → "Iniciar sesión" (un mismo usuario puede ser ambos).
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { Icono, type NombreIcono } from '../../../web/src/components/ui/Icono';
import { posicionCursor, ventana } from '../animacion/cursor';
import { entrada, fundidoEscena, tramo } from '../animacion/tiempo';
import { PantallaApp } from '../app/PantallaApp';
import { Cursor } from '../marco/Cursor';
import { Fondo } from '../marco/Fondo';
import { MarcoCelular } from '../marco/MarcoCelular';
import { Antetitulo, Titular } from '../marco/TextoSobreimpreso';
import { PantallaInicio } from '../pantallas/Inicio';

/** Centro de cada botón en la pantalla de Inicio (coordenadas del área de contenido del celular). */
const BOTON = { iniciar: { x: 195, y: 461 }, invitado: { x: 195, y: 521 } } as const;

interface Rol {
  icono: NombreIcono;
  nombre: string;
  descripcion: string;
  /** Fracciones de la escena en que la locución lo nombra. */
  desde: number;
  hasta: number;
}

const ROLES: readonly Rol[] = [
  {
    icono: 'buscar',
    nombre: 'Invitado',
    descripcion: 'Explora y busca cargadores sin crear una cuenta',
    desde: 0.14,
    hasta: 0.4,
  },
  {
    icono: 'auto',
    nombre: 'Conductor registrado',
    descripcion: 'Recibe recomendaciones personalizadas, reserva y guarda favoritos',
    desde: 0.4,
    hasta: 0.68,
  },
  {
    icono: 'casa',
    nombre: 'Anfitrión',
    descripcion: 'Publica su cargador privado para que otros lo reserven',
    desde: 0.68,
    hasta: 0.92,
  },
];

function TarjetaRol({ rol, frame, d }: { rol: Rol; frame: number; d: number }) {
  const aparece = entrada(frame, d, rol.desde, rol.desde + 0.05, 28);
  // Mientras se nombra, la tarjeta se destaca; después queda atenuada; al final, todas iguales.
  const activa = Math.max(ventana(frame, d, rol.desde, rol.hasta, 8), tramo(frame, d, 0.92, 0.97));
  return (
    <div
      style={{
        ...aparece,
        opacity: aparece.opacity * (0.5 + 0.5 * activa),
        display: 'flex',
        alignItems: 'center',
        gap: 26,
        padding: '24px 30px',
        borderRadius: 'var(--radio-tarjeta-grande)',
        background: `rgb(255 255 255 / ${0.4 + 0.6 * activa})`,
        boxShadow: activa > 0 ? `0 12px 32px rgb(27 29 26 / ${0.1 * activa})` : 'none',
        border: '1px solid var(--color-borde-suave)',
      }}
    >
      <span
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 76,
          height: 76,
          flex: 'none',
          borderRadius: '50%',
          background: 'var(--color-primario-claro)',
          color: 'var(--color-primario)',
        }}
      >
        <Icono nombre={rol.icono} tamano={38} />
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span
          style={{
            fontFamily: 'var(--fuente-titulos)',
            fontWeight: 700,
            fontSize: 36,
            color: 'var(--color-texto)',
          }}
        >
          {rol.nombre}
        </span>
        <span
          style={{
            fontFamily: 'var(--fuente-cuerpo)',
            fontWeight: 500,
            fontSize: 25,
            color: 'var(--color-texto-secundario)',
          }}
        >
          {rol.descripcion}
        </span>
      </span>
    </div>
  );
}

export function Escena02Roles() {
  const frame = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();

  // Recorrido del cursor: entra desde abajo, pasa a "Continuar como invitado" y luego a "Iniciar sesión".
  const cursor = posicionCursor(frame, d, [
    { t: 0.06, x: 300, y: 720 },
    { t: 0.16, x: BOTON.invitado.x + 40, y: BOTON.invitado.y + 4 },
    { t: 0.4, x: BOTON.invitado.x + 40, y: BOTON.invitado.y + 4 },
    { t: 0.46, x: BOTON.iniciar.x + 30, y: BOTON.iniciar.y + 4 },
  ]);
  const cursorVisible = Math.min(tramo(frame, d, 0.04, 0.08), 1 - tramo(frame, d, 0.92, 0.96));

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
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={entrada(frame, d, 0.02, 0.08)}>
              <Antetitulo>Roles</Antetitulo>
            </div>
            <div style={{ ...entrada(frame, d, 0.04, 0.11, 32), marginBottom: 20 }}>
              <Titular>Tres roles, una sola app</Titular>
            </div>
            {ROLES.map((rol) => (
              <TarjetaRol key={rol.nombre} rol={rol} frame={frame} d={d} />
            ))}
          </div>

          <MarcoCelular>
            <PantallaInicio
              frame={frame}
              duracion={d}
              animarEntrada={false}
              hover={{
                invitado: ventana(frame, d, 0.15, 0.41, 5),
                iniciar: ventana(frame, d, 0.45, 0.93, 5),
              }}
            />
            <Cursor x={cursor.x} y={cursor.y} opacidad={cursorVisible} />
          </MarcoCelular>
        </AbsoluteFill>
      </PantallaApp>
    </AbsoluteFill>
  );
}
