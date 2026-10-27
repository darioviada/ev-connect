// Íconos de trazo (outline, 2 px) dibujados para el proyecto. Decorativos por defecto (aria-hidden);
// los botones que solo tienen ícono llevan su propio aria-label.
const TRAZOS: Record<string, string> = {
  volver: 'M19 12H5M11 18l-6-6 6-6',
  mapa: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2ZM9 4v14M15 6v14',
  lista: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 1 1 14 0C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  gps: 'M12 3v3M12 18v3M3 12h3M18 12h3M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-3a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  bateria: 'M4 8h13a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1ZM21 11v2',
  velocimetro: 'M5 17a8 8 0 1 1 14 0M12 13l3.5-4',
  enchufe: 'M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0V7ZM12 17v5',
  rayo: 'M13 2 4 14h7l-1 8 9-12h-7l1-8Z',
  auto: 'M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13M4 13h16v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4ZM7 16h.01M17 16h.01',
  calendario: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  corazon:
    'M12 20s-7.5-4.6-9.3-9.2C1.5 7.6 3.6 4.5 7 4.5c2 0 3.3 1.1 5 3 1.7-1.9 3-3 5-3 3.4 0 5.5 3.1 4.3 6.3C19.5 15.4 12 20 12 20Z',
  casa: 'M3 11 12 4l9 7M5 10v10h14V10',
  usuario: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
  salir: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11',
  mas: 'M12 5v14M5 12h14',
  basura: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  buscar: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4',
  reloj: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  escudo: 'M12 3 5 6v6c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6l-7-3Z',
  check: 'M5 12.5 10 17l9-10',
  x: 'M6 6l12 12M18 6 6 18',
  ruta: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 15V9a4 4 0 0 1 4-4h6M18 9v6a4 4 0 0 1-4 4H8',
};

export type NombreIcono = keyof typeof TRAZOS;

export function Icono({
  nombre,
  tamano = 22,
  relleno = false,
  className,
}: {
  nombre: NombreIcono;
  tamano?: number;
  relleno?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={tamano}
      height={tamano}
      aria-hidden="true"
      focusable="false"
      className={className}
      fill={relleno ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={TRAZOS[nombre]} />
    </svg>
  );
}
