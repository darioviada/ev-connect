// Escena 3 — Registro e inicio de sesión (guion 0:40–0:55). Cambia entre "Iniciar sesión" y "Registrarme",
// se completan correo y contraseña y se toca "Continuar". La autenticación la resuelve AWS Cognito.
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { Icono } from '../../../web/src/components/ui/Icono';
import { parpadeo, posicionCursor, tipeado, toque } from '../animacion/cursor';
import { entrada, tramo } from '../animacion/tiempo';
import { Cursor } from '../marco/Cursor';
import { Escenario } from '../marco/Escenario';
import { Antetitulo, Linea, Titular } from '../marco/TextoSobreimpreso';
import { PantallaLogin, POS_LOGIN, type CampoLogin, type PestanaLogin } from '../pantallas/Login';

const EMAIL = 'juan.perez@correo.com';
const LARGO_PASSWORD = 10;

/** Momentos (fracciones de la escena) de cada toque. */
const T = {
  registrarme: 0.14,
  ingresar: 0.34,
  email: 0.42,
  password: 0.64,
  continuar: 0.82,
} as const;

export function Escena03Acceso() {
  const frame = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();
  const ahora = frame / d;

  const pestana: PestanaLogin =
    ahora >= T.registrarme && ahora < T.ingresar ? 'registrarme' : 'ingresar';
  const enfocado: CampoLogin =
    ahora >= T.continuar
      ? null
      : ahora >= T.password
        ? 'password'
        : ahora >= T.email
          ? 'email'
          : null;
  const email = tipeado(EMAIL, frame, d, T.email + 0.03, T.password - 0.04);
  const password = Math.round(
    LARGO_PASSWORD * tramo(frame, d, T.password + 0.03, T.continuar - 0.05),
  );

  const P = POS_LOGIN;
  const cursor = posicionCursor(frame, d, [
    { t: 0.04, x: 320, y: 620 },
    { t: T.registrarme, x: P.pestanaRegistrarme.x, y: P.pestanaRegistrarme.y },
    { t: T.ingresar, x: P.pestanaIngresar.x, y: P.pestanaIngresar.y },
    { t: T.email, x: P.email.x + 90, y: P.email.y },
    { t: T.password, x: P.password.x + 90, y: P.password.y },
    { t: T.continuar, x: P.continuar.x + 40, y: P.continuar.y },
  ]);
  const toques = Math.max(
    toque(frame, d, T.registrarme),
    toque(frame, d, T.ingresar),
    toque(frame, d, T.email),
    toque(frame, d, T.password),
    toque(frame, d, T.continuar),
  );

  return (
    <Escenario
      textos={
        <>
          <div style={entrada(frame, d, 0.02, 0.08)}>
            <Antetitulo>Acceso seguro</Antetitulo>
          </div>
          <div style={entrada(frame, d, 0.04, 0.11, 32)}>
            <Titular>Registro e inicio de sesión</Titular>
          </div>
          <div
            style={{
              ...entrada(frame, d, 0.1, 0.17),
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              marginTop: 10,
            }}
          >
            <span style={{ color: 'var(--color-primario)', display: 'grid' }}>
              <Icono nombre="escudo" tamano={34} />
            </span>
            <Linea>Autenticación delegada en AWS Cognito</Linea>
          </div>
        </>
      }
      celular={
        <>
          <PantallaLogin
            pestana={pestana}
            email={email}
            password={password}
            enfocado={enfocado}
            caret={parpadeo(frame)}
            enviando={ahora >= T.continuar + 0.02}
          />
          <Cursor
            x={cursor.x}
            y={cursor.y}
            toque={toques}
            opacidad={Math.min(tramo(frame, d, 0.02, 0.05), 1 - tramo(frame, d, 0.92, 0.96))}
          />
        </>
      }
    />
  );
}
