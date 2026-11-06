// Cursor (flecha) con un "toque" opcional: un círculo que se expande y se desvanece.
export function Cursor({
  x,
  y,
  opacidad = 1,
  toque = 0,
}: {
  x: number;
  y: number;
  opacidad?: number;
  /** Progreso del toque (0 = nada, de 0 a 1 se expande el círculo). */
  toque?: number;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        opacity: opacidad,
        pointerEvents: 'none',
        zIndex: 50,
      }}
    >
      {toque > 0 && toque < 1 && (
        <span
          style={{
            position: 'absolute',
            left: -22,
            top: -22,
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'rgb(12 127 87 / 0.35)',
            transform: `scale(${0.4 + toque})`,
            opacity: 1 - toque,
          }}
        />
      )}
      <svg
        width="28"
        height="34"
        viewBox="0 0 28 34"
        style={{
          position: 'absolute',
          left: -3,
          top: -2,
          filter: 'drop-shadow(0 2px 3px rgb(0 0 0 / 0.3))',
          transform: `scale(${1 - 0.12 * Math.sin(Math.PI * Math.min(1, toque * 2))})`,
          transformOrigin: '3px 2px',
        }}
      >
        <path
          d="M3 2 L3 26 L9.5 20 L14 31 L18.5 29 L14 18.5 L23 18.5 Z"
          fill="#1b1d1a"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
