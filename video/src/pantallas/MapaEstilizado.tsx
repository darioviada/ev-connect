// Mapa estilizado (SVG) del noroeste de Córdoba para la vista de resultados. Reemplaza a Leaflet + mosaicos
// de OpenStreetMap, que se descargan por red y harían el render no reproducible. Los pines y marcadores
// usan las mismas clases que la app (Mapa.module.css) y el recorrido, el mismo trazo (#0c7f57, 5 px).
import type { CSSProperties } from 'react';
import mapa from '../../../web/src/components/Mapa/Mapa.module.css';
import { Icono } from '../../../web/src/components/ui/Icono';

export const ANCHO_MAPA = 390;
export const ALTO_MAPA = 400;

/** Recorrido Casa → Trabajo (coordenadas del SVG). */
const RECORRIDO = 'M 58 92 L 112 118 L 168 128 L 214 160 L 262 196 L 300 248 L 336 292';
export const CASA_XY = { x: 58, y: 92 };
export const TRABAJO_XY = { x: 336, y: 292 };

export interface PinMapa {
  id: string;
  x: number;
  y: number;
  destacado: boolean;
  /** 0 = todavía no apareció, 1 = en su lugar. */
  aparicion: number;
  /** Pulso del pin destacado (0 a 1). */
  pulso?: number;
}

function Pin({ pin }: { pin: PinMapa }) {
  const tam = pin.destacado ? 44 : 34;
  const caida = 1 - pin.aparicion;
  const estilo: CSSProperties = {
    position: 'absolute',
    left: pin.x - tam / 2,
    top: pin.y - tam / 2,
    opacity: Math.min(1, pin.aparicion * 1.5),
    transform: `translateY(${-28 * caida}px) scale(${0.7 + 0.3 * pin.aparicion})`,
  };
  return (
    <div style={estilo}>
      {pin.destacado && (pin.pulso ?? 0) > 0 && (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'rgb(12 127 87 / 0.35)',
            transform: `scale(${1 + 1.2 * (pin.pulso ?? 0)})`,
            opacity: 1 - (pin.pulso ?? 0),
          }}
        />
      )}
      <span className={`${mapa.pin} ${pin.destacado ? mapa.pinDestacado : ''}`}>
        <Icono nombre="rayo" tamano={18} />
      </span>
    </div>
  );
}

export function MapaEstilizado({ trazo, pines }: { trazo: number; pines: readonly PinMapa[] }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <svg
        viewBox={`0 0 ${ANCHO_MAPA} ${ALTO_MAPA}`}
        preserveAspectRatio="xMidYMin slice"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        <rect width={ANCHO_MAPA} height={ALTO_MAPA} fill="#f2efe9" />
        {/* Parques */}
        <rect x="18" y="168" width="96" height="58" rx="10" fill="#d6ead0" />
        <rect x="246" y="38" width="88" height="54" rx="10" fill="#d6ead0" />
        <rect x="150" y="300" width="70" height="60" rx="10" fill="#d6ead0" />
        {/* Río Suquía */}
        <path
          d="M -10 262 C 70 236, 140 290, 210 252 S 330 206, 400 228"
          fill="none"
          stroke="#aad3df"
          strokeWidth="12"
        />
        {/* Calles secundarias */}
        {[40, 80, 120, 160, 200, 240, 280, 320, 360].map((y) => (
          <line
            key={`h${y}`}
            x1="0"
            y1={y}
            x2={ANCHO_MAPA}
            y2={y - 18}
            stroke="#ffffff"
            strokeWidth="2.5"
          />
        ))}
        {[30, 75, 120, 165, 210, 255, 300, 345].map((x) => (
          <line
            key={`v${x}`}
            x1={x}
            y1="0"
            x2={x + 26}
            y2={ALTO_MAPA}
            stroke="#ffffff"
            strokeWidth="2.5"
          />
        ))}
        {/* Avenidas (con borde) */}
        {[
          'M -10 128 L 400 96',
          'M 90 -10 C 120 120, 180 220, 230 410',
          'M -10 330 C 120 300, 260 330, 400 300',
        ].map((d) => (
          <g key={d}>
            <path d={d} fill="none" stroke="#ddd6c8" strokeWidth="10" />
            <path d={d} fill="none" stroke="#fffdf6" strokeWidth="7" />
          </g>
        ))}
        {/* Nombres de zonas */}
        <g fill="#8a8578" fontSize="10" fontFamily="var(--fuente-cuerpo)">
          <text x="20" y="62">
            Cerro de las Rosas
          </text>
          <text x="236" y="112">
            Alta Córdoba
          </text>
          <text x="30" y="290">
            Río Suquía
          </text>
          <text x="268" y="370">
            Centro
          </text>
        </g>
        {/* Recorrido (se dibuja de a poco) */}
        <path
          d={RECORRIDO}
          pathLength={1}
          fill="none"
          stroke="#0c7f57"
          strokeOpacity="0.85"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="1"
          strokeDashoffset={1 - trazo}
        />
      </svg>
      <span
        className={mapa.origen}
        style={{ position: 'absolute', left: CASA_XY.x - 10, top: CASA_XY.y - 10 }}
      />
      <span
        className={mapa.destino}
        style={{
          position: 'absolute',
          left: TRABAJO_XY.x - 10,
          top: TRABAJO_XY.y - 20,
          opacity: trazo > 0.98 ? 1 : 0,
        }}
      />
      {pines.map((p) => (
        <Pin key={p.id} pin={p} />
      ))}
    </div>
  );
}
