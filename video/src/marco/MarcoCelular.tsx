// Marco de celular (390 × 844, como un teléfono actual) con barra de estado. Adentro va la app real.
import type { CSSProperties, ReactNode } from 'react';

export const PANTALLA = { ancho: 390, alto: 844 } as const;
const BISEL = 14;

export function MarcoCelular({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        width: PANTALLA.ancho + BISEL * 2,
        height: PANTALLA.alto + BISEL * 2,
        padding: BISEL,
        borderRadius: 60,
        background: '#1b1d1a',
        boxShadow:
          '0 2px 0 1px #3a3d37 inset, 0 40px 80px rgb(27 29 26 / 0.28), 0 12px 24px rgb(27 29 26 / 0.18)',
        ...style,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: PANTALLA.ancho,
          height: PANTALLA.alto,
          borderRadius: 46,
          overflow: 'hidden',
          background: 'var(--color-superficie)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <BarraDeEstado />
        <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>{children}</div>
        {/* Indicador de inicio */}
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: '50%',
            width: 134,
            height: 5,
            marginLeft: -67,
            borderRadius: 3,
            background: 'var(--color-texto)',
            opacity: 0.85,
          }}
        />
      </div>
    </div>
  );
}

function BarraDeEstado() {
  return (
    <div
      style={{
        position: 'relative',
        height: 50,
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 30px 0 34px',
        fontFamily: 'var(--fuente-titulos)',
        fontWeight: 600,
        fontSize: 16,
        color: 'var(--color-texto)',
      }}
    >
      <span>9:41</span>
      {/* Isla dinámica */}
      <span
        style={{
          position: 'absolute',
          top: 11,
          left: '50%',
          width: 120,
          height: 34,
          marginLeft: -60,
          borderRadius: 20,
          background: '#1b1d1a',
        }}
      />
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }} aria-hidden="true">
        <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor">
          <rect x="0" y="8" width="3" height="4" rx="1" />
          <rect x="5" y="5" width="3" height="7" rx="1" />
          <rect x="10" y="2.5" width="3" height="9.5" rx="1" />
          <rect x="15" y="0" width="3" height="12" rx="1" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12" fill="none" stroke="currentColor">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3" opacity="0.45" />
          <rect x="2.5" y="2.5" width="15" height="7" rx="1.5" fill="currentColor" stroke="none" />
          <path d="M24.5 4v4" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
        </svg>
      </span>
    </div>
  );
}
