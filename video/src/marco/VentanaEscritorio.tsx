// Ventana de navegador de escritorio con la app adentro (escena 9). Fuera del celular, las reglas @media de
// la app (min-width: 1024px) se aplican tal cual: es el diseño de escritorio real.
import type { CSSProperties, ReactNode } from 'react';
import { CLASE_ESCRITORIO } from '../app/EstilosMovil';

export const VENTANA = { ancho: 1440, alto: 780 } as const;

export function VentanaEscritorio({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        width: VENTANA.ancho,
        borderRadius: 14,
        overflow: 'hidden',
        background: '#ffffff',
        boxShadow: '0 40px 90px rgb(27 29 26 / 0.25), 0 0 0 1px rgb(27 29 26 / 0.08)',
        ...style,
      }}
    >
      {/* Barra del navegador */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          height: 46,
          padding: '0 18px',
          background: '#ecefea',
          borderBottom: '1px solid var(--color-borde)',
        }}
      >
        <span style={{ display: 'flex', gap: 8 }}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
            <span key={c} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />
          ))}
        </span>
        <span
          style={{
            flex: 1,
            maxWidth: 520,
            margin: '0 auto',
            padding: '6px 14px',
            borderRadius: 8,
            background: '#ffffff',
            color: 'var(--color-texto-secundario)',
            fontFamily: 'var(--fuente-cuerpo)',
            fontSize: 14,
            textAlign: 'center',
          }}
        >
          localhost:5173
        </span>
        <span style={{ width: 52 }} />
      </div>
      <div
        className={CLASE_ESCRITORIO}
        style={{
          position: 'relative',
          height: VENTANA.alto,
          overflow: 'hidden',
          background: 'var(--color-fondo)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
