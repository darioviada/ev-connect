// Resultados (web/src/pages/Resultados): lista de cargadores recomendados y vista de mapa, con la tarjeta
// real (TarjetaRecomendacion) y el CSS Module real. El resumen se arma con su mismo marcado (en la app vive
// junto a componentes que dependen de la sesión y la API).
import type { CSSProperties, ReactNode } from 'react';
import type { Recomendacion } from '../../../web/src/api/tipos';
import s from '../../../web/src/components/Resultados/Resultados.module.css';
import { TarjetaRecomendacion } from '../../../web/src/components/Resultados/TarjetaRecomendacion';
import { BotonIcono, Cabecera } from '../../../web/src/components/ui';
import { km } from '../../../web/src/dominio/formato';
import { DOLPHIN_MINI } from '../datos/vehiculos';
import { MapaEstilizado, type PinMapa } from './MapaEstilizado';
import { MarcoApp } from './MarcoApp';

const BATERIA = 18;
const AUTONOMIA = 53;

/** Igual que ResumenBusqueda de la app. */
function Resumen() {
  return (
    <p className={s.resumen}>
      <span>
        <strong>
          {DOLPHIN_MINI.marca} {DOLPHIN_MINI.modelo}
        </strong>
      </span>
      <span>
        Batería <strong>{BATERIA}%</strong>
      </span>
      <span>
        Urgencia <strong>Alta</strong>
      </span>
      <span>
        Autonomía actual <strong>{km(AUTONOMIA)}</strong>
      </span>
    </p>
  );
}

/** Anillo de resaltado alrededor de una tarjeta (el foco de la explicación). */
function Resaltable({
  activo,
  style,
  children,
}: {
  activo: number;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        borderRadius: 'var(--radio-tarjeta)',
        boxShadow: `0 0 0 ${3 * activo}px var(--color-primario), 0 ${10 * activo}px ${28 * activo}px rgb(12 127 87 / ${0.18 * activo})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function PantallaResultadosLista({
  recomendaciones,
  entrada,
  resaltado,
  hoverMapa,
  desplazamiento = 0,
}: {
  recomendaciones: readonly Recomendacion[];
  /** Estilo de entrada de cada tarjeta. */
  entrada: (i: number) => CSSProperties;
  /** Intensidad del resaltado de cada tarjeta (0 a 1). */
  resaltado: (i: number) => number;
  hoverMapa: number;
  desplazamiento?: number;
}) {
  return (
    <MarcoApp seccion="home" desplazamiento={desplazamiento}>
      <Cabecera
        titulo="Cargadores recomendados"
        subtitulo="Casa → Trabajo"
        volver="/"
        accion={
          <div style={{ transform: `scale(${1 + 0.08 * hoverMapa})` }}>
            <BotonIcono icono="mapa" etiqueta="Ver en el mapa" suave />
          </div>
        }
      />
      <Resumen />
      <ul className={s.lista}>
        {recomendaciones.map((rec, i) => (
          <li key={rec.cargador.id} style={entrada(i)}>
            <Resaltable activo={resaltado(i)}>
              <TarjetaRecomendacion
                rec={rec}
                modo="ruta"
                enlace={`/cargadores/${rec.cargador.id}`}
              />
            </Resaltable>
          </li>
        ))}
      </ul>
    </MarcoApp>
  );
}

export function PantallaResultadosMapa({
  recomendaciones,
  trazo,
  pines,
}: {
  recomendaciones: readonly Recomendacion[];
  trazo: number;
  pines: readonly PinMapa[];
}) {
  return (
    <MarcoApp seccion="home" sinNavegacion>
      <div className={s.vistaMapa}>
        <div className={s.barraFlotante}>
          <BotonIcono icono="volver" etiqueta="Volver al buscador" />
          <span className={s.tituloRuta}>Casa → Trabajo</span>
          <BotonIcono icono="lista" etiqueta="Ver como lista" />
        </div>
        <div className={s.mapaCompleto} style={{ minHeight: 0 }}>
          <MapaEstilizado trazo={trazo} pines={pines} />
        </div>
        <section className={s.hoja} aria-label="Resultados de la búsqueda">
          <div className={s.asa} aria-hidden="true" />
          <Resumen />
          <h2 className={s.conteo}>
            {recomendaciones.length} cargadores en tu ruta, ordenados según tu búsqueda
          </h2>
          <ul className={s.lista}>
            {recomendaciones.map((rec) => (
              <li key={rec.cargador.id}>
                <TarjetaRecomendacion
                  compacta
                  rec={rec}
                  modo="ruta"
                  enlace={`/cargadores/${rec.cargador.id}`}
                />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </MarcoApp>
  );
}
