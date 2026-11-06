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
import { Escena02Roles } from './escenas/Escena02Roles';
import { Escena03Acceso } from './escenas/Escena03Acceso';
import { Escena04Vehiculos } from './escenas/Escena04Vehiculos';
import { Escena05Busqueda } from './escenas/Escena05Busqueda';
import { Escena06Recomendaciones } from './escenas/Escena06Recomendaciones';
import { Escena07Reserva } from './escenas/Escena07Reserva';
import { Escena08Publicar } from './escenas/Escena08Publicar';
import { Escena09Favoritos } from './escenas/Escena09Favoritos';
import { precargarImagenes } from './app/precarga';
import { DOLPHIN_MINI, E208 } from './datos/vehiculos';
import { Pendiente } from './escenas/Pendiente';

cargarFuentes();
precargarImagenes([DOLPHIN_MINI.fotoUrl!, E208.fotoUrl!]);

/** Escenas ya armadas; el resto muestra un marcador con su tramo de la línea de tiempo. */
const COMPONENTES: Partial<Record<string, ComponentType>> = {
  apertura: Escena01Apertura,
  roles: Escena02Roles,
  acceso: Escena03Acceso,
  vehiculos: Escena04Vehiculos,
  busqueda: Escena05Busqueda,
  recomendaciones: Escena06Recomendaciones,
  reserva: Escena07Reserva,
  publicar: Escena08Publicar,
  favoritos: Escena09Favoritos,
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
