// Composiciones: el video completo y cada escena por separado (para revisarlas en Remotion Studio).
import type { ComponentType } from 'react';
import { Composition, Series } from 'remotion';
import { cargarFuentes } from './app/fuentes';
import {
  ALTO,
  ANCHO,
  DURACION_TOTAL,
  FPS,
  LINEA_DE_TIEMPO,
  type TramoEscena,
} from './config/escenas';
import { Escena01Apertura } from './escenas/Escena01Apertura';
import { Pendiente } from './escenas/Pendiente';

cargarFuentes();

/** Escenas ya armadas; el resto muestra un marcador con su tramo de la línea de tiempo. */
const COMPONENTES: Partial<Record<string, ComponentType>> = {
  apertura: Escena01Apertura,
};

function EscenaDe({ escena }: { escena: TramoEscena }) {
  const Componente = COMPONENTES[escena.id];
  return Componente ? <Componente /> : <Pendiente escena={escena} />;
}

function DemoEVConnect() {
  return (
    <Series>
      {LINEA_DE_TIEMPO.map((e) => (
        <Series.Sequence key={e.id} durationInFrames={e.duracion} name={`${e.numero}. ${e.nombre}`}>
          <EscenaDe escena={e} />
        </Series.Sequence>
      ))}
    </Series>
  );
}

const dos = (n: number) => String(n).padStart(2, '0');

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="DemoEVConnect"
        component={DemoEVConnect}
        durationInFrames={DURACION_TOTAL}
        fps={FPS}
        width={ANCHO}
        height={ALTO}
      />
      {LINEA_DE_TIEMPO.map((e) => (
        <Composition
          key={e.id}
          id={`Escena${dos(e.numero)}-${e.id}`}
          component={() => <EscenaDe escena={e} />}
          durationInFrames={e.duracion}
          fps={FPS}
          width={ANCHO}
          height={ALTO}
        />
      ))}
    </>
  );
}
