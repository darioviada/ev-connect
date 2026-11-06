// Pantalla de Login/Registro (web/src/pages/Login) con sus componentes y CSS Module reales, tal como se ve
// en modo Cognito (sin el aviso de modo demo local ni los usuarios de demostración).
import type { CSSProperties } from 'react';
import { Boton, Campo, claseControl, Segmentado } from '../../../web/src/components/ui';
import login from '../../../web/src/pages/Login/Login.module.css';

export type PestanaLogin = 'ingresar' | 'registrarme';
export type CampoLogin = 'nombre' | 'email' | 'password' | null;

/** Simula el foco visible de la app (:focus-visible) sobre el campo activo. */
const foco = (activo: boolean): CSSProperties =>
  activo ? { outline: 'var(--foco-anillo)', outlineOffset: 'var(--foco-separacion)' } : {};

export function PantallaLogin({
  pestana,
  email,
  password,
  enfocado,
  caret,
  enviando,
}: {
  pestana: PestanaLogin;
  email: string;
  /** Cantidad de caracteres tipeados (se muestran como puntos). */
  password: number;
  enfocado: CampoLogin;
  /** 1 = se ve el cursor de texto en el campo enfocado. */
  caret: number;
  enviando: boolean;
}) {
  const conCaret = (texto: string, campo: CampoLogin) =>
    enfocado === campo && caret ? `${texto}|` : texto;

  return (
    <main className={login.pagina} style={{ minHeight: '100%' }}>
      <span className={login.marca}>EVConnect</span>

      <Segmentado
        pestanas
        etiqueta="Acceso"
        opciones={[
          { valor: 'ingresar', nombre: 'Iniciar sesión' },
          { valor: 'registrarme', nombre: 'Registrarme' },
        ]}
        valor={pestana}
        onCambio={() => undefined}
      />

      <form className={login.formulario}>
        {pestana === 'registrarme' && (
          <Campo etiqueta="Nombre">
            {(p) => (
              <input
                {...p}
                className={claseControl}
                readOnly
                value={conCaret('', 'nombre')}
                style={foco(enfocado === 'nombre')}
              />
            )}
          </Campo>
        )}
        <Campo etiqueta="Correo electrónico">
          {(p) => (
            <input
              {...p}
              type="email"
              className={claseControl}
              placeholder="nombre@correo.com"
              readOnly
              value={conCaret(email, 'email')}
              style={foco(enfocado === 'email')}
            />
          )}
        </Campo>
        <Campo
          etiqueta="Contraseña"
          ayuda={
            pestana === 'registrarme'
              ? 'Mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo.'
              : undefined
          }
        >
          {(p) => (
            <input
              {...p}
              type="password"
              className={claseControl}
              readOnly
              value={'x'.repeat(password)}
              style={foco(enfocado === 'password')}
            />
          )}
        </Campo>
        <Boton type="button" anchoCompleto cargando={enviando}>
          Continuar
        </Boton>
      </form>
    </main>
  );
}

/**
 * Centros de los elementos (área de contenido del celular, 390 px de ancho), calculados con el CSS de la
 * página: 48 px arriba, separación 24 px, pestañas de 56 px, campos de 83 px y botón de 48 px.
 */
export const POS_LOGIN = {
  pestanaIngresar: { x: 110, y: 143 },
  pestanaRegistrarme: { x: 280, y: 143 },
  email: { x: 195, y: 251 },
  password: { x: 195, y: 351 },
  continuar: { x: 195, y: 417 },
} as const;
