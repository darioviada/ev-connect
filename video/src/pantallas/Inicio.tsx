// Pantalla de Inicio de la app (web/src/pages/Inicio) con sus componentes y CSS Module reales, sin la
// lógica de sesión ni navegación. La usan las escenas 1, 2 y 10.
import type { CSSProperties, ReactNode } from 'react';
import { Boton, EnlaceBoton, Icono } from '../../../web/src/components/ui';
import inicio from '../../../web/src/pages/Inicio/Inicio.module.css';
import { entrada, tramo } from '../animacion/tiempo';

export type BotonInicio = 'iniciar' | 'invitado';

/** Simula el :hover del botón (en un video no hay mouse real). */
function ConHover({ activo, children }: { activo: number; children: ReactNode }) {
  return (
    <div
      style={{
        borderRadius: 'var(--radio-boton)',
        boxShadow: `0 0 0 ${4 * activo}px rgb(12 127 87 / 0.18)`,
        transform: `scale(${1 + 0.02 * activo})`,
        filter: `brightness(${1 - 0.06 * activo})`,
      }}
    >
      {children}
    </div>
  );
}

export function PantallaInicio({
  frame,
  duracion,
  animarEntrada = true,
  hover = {},
}: {
  frame: number;
  duracion: number;
  /** En la escena 1 los elementos entran escalonados; en las demás ya están. */
  animarEntrada?: boolean;
  /** Intensidad del hover (0 a 1) de cada botón. */
  hover?: Partial<Record<BotonInicio, number>>;
}) {
  const visible = { opacity: 1 } satisfies CSSProperties;
  const en = (desde: number, hasta: number, distancia?: number) =>
    animarEntrada ? entrada(frame, duracion, desde, hasta, distancia) : visible;
  const logo = animarEntrada ? tramo(frame, duracion, 0.03, 0.09) : 1;

  return (
    <main className={inicio.pagina} style={{ minHeight: '100%', height: '100%' }}>
      <div
        className={inicio.logo}
        aria-hidden="true"
        style={{ opacity: logo, transform: `scale(${0.6 + 0.4 * logo})` }}
      >
        <Icono nombre="rayo" tamano={40} />
      </div>
      <h1 className={inicio.titulo} style={en(0.06, 0.12)}>
        EVConnect
      </h1>
      <p className={inicio.subtitulo} style={en(0.08, 0.14)}>
        Cargadores públicos y privados, recomendados para vos
      </p>
      <div className={inicio.acciones} style={en(0.1, 0.17)}>
        <ConHover activo={hover.iniciar ?? 0}>
          <EnlaceBoton a="/login" anchoCompleto>
            Iniciar sesión
          </EnlaceBoton>
        </ConHover>
        <ConHover activo={hover.invitado ?? 0}>
          <Boton variante="contorno" anchoCompleto>
            Continuar como invitado
          </Boton>
        </ConHover>
      </div>
      <p className={inicio.aviso} role="note" style={en(0.13, 0.19, 12)}>
        Datos de demostración (sintéticos)
      </p>
    </main>
  );
}
