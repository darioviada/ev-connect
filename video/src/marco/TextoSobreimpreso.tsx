// Textos sobreimpresos con la tipografía de la app. Breves: un antetítulo, un título y una línea.
import type { CSSProperties, ReactNode } from 'react';

export function Antetitulo({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        fontFamily: 'var(--fuente-cuerpo)',
        fontWeight: 600,
        fontSize: 22,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'var(--color-primario)',
        ...style,
      }}
    >
      <span
        style={{ width: 36, height: 3, borderRadius: 2, background: 'var(--color-primario)' }}
      />
      {children}
    </div>
  );
}

export function Titular({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <h1
      style={{
        margin: 0,
        fontFamily: 'var(--fuente-titulos)',
        fontWeight: 700,
        fontSize: 58,
        lineHeight: 1.12,
        letterSpacing: '-0.015em',
        color: 'var(--color-texto)',
        ...style,
      }}
    >
      {children}
    </h1>
  );
}

export function Linea({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <p
      style={{
        margin: 0,
        fontFamily: 'var(--fuente-cuerpo)',
        fontWeight: 500,
        fontSize: 30,
        lineHeight: 1.35,
        color: 'var(--color-texto-secundario)',
        ...style,
      }}
    >
      {children}
    </p>
  );
}
