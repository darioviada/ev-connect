// "Publicar cargador" y "Mis cargadores" (web/src/pages/Publicar) con sus CSS Modules y componentes reales.
// El selector de ubicación se arma con su mismo CSS (en la app consulta la API de direcciones).
import type { CSSProperties } from 'react';
import buscador from '../../../web/src/components/Buscador/Buscador.module.css';
import {
  Boton,
  BotonIcono,
  Cabecera,
  Campo,
  claseControl,
  EnlaceBoton,
  Icono,
  Insignia,
  Tarjeta,
} from '../../../web/src/components/ui';
import { CONECTORES_OPCIONES, kw, nombreConector, pesos } from '../../../web/src/dominio/formato';
import pub from '../../../web/src/pages/Publicar/Publicar.module.css';
import { ListaDesplegada } from '../marco/ListaDesplegada';
import { MapaEstilizado } from './MapaEstilizado';
import { MarcoApp } from './MarcoApp';

export type CampoPublicar =
  'nombre' | 'buscarUbicacion' | 'conector' | 'potencia' | 'precio' | 'desde' | 'hasta' | null;

export interface Franja {
  dia: string;
  desde: string;
  hasta: string;
}

export interface LugarEncontrado {
  nombre: string;
  descripcion: string;
  lat: number;
  lng: number;
}

const foco: CSSProperties = {
  outline: 'var(--foco-anillo)',
  outlineOffset: 'var(--foco-separacion)',
};

export function PantallaPublicar({
  nombre,
  busqueda,
  resultados,
  ubicacion,
  conector,
  conectorDesplegado,
  potencia,
  precio,
  franjas,
  entradaFranja,
  enfocado,
  caret,
  enviando,
  desplazamiento,
}: {
  nombre: string;
  busqueda: string;
  resultados: readonly LugarEncontrado[] | null;
  ubicacion: LugarEncontrado | null;
  conector: string;
  conectorDesplegado: boolean;
  potencia: string;
  precio: string;
  franjas: readonly Franja[];
  /** Estilo de entrada de cada franja (al copiar el horario a todos los días). */
  entradaFranja: (i: number) => CSSProperties;
  enfocado: CampoPublicar;
  caret: number;
  enviando: boolean;
  desplazamiento: number;
}) {
  const conCaret = (texto: string, campo: CampoPublicar) =>
    enfocado === campo && caret ? `${texto}|` : texto;
  const estilo = (campo: CampoPublicar) => (enfocado === campo ? foco : undefined);

  return (
    <MarcoApp seccion="publicar" desplazamiento={desplazamiento}>
      <form className={pub.formulario}>
        <Cabecera titulo="Publicar cargador" volver="/" />

        <Campo etiqueta="Nombre" ayuda="Por ejemplo: “Cochera de Ana”.">
          {(p) => (
            <input
              {...p}
              className={claseControl}
              readOnly
              value={conCaret(nombre, 'nombre')}
              style={estilo('nombre')}
            />
          )}
        </Campo>
        <Campo etiqueta="Dirección" ayuda="Se muestra a quien reserve. Opcional.">
          {(p) => (
            <input
              {...p}
              className={claseControl}
              placeholder="Dirección del cargador"
              readOnly
              value=""
            />
          )}
        </Campo>

        {/* Selector de ubicación (mismo marcado que SelectorUbicacion) */}
        <div className={buscador.bloque}>
          <label className={buscador.etiqueta}>Ubicación</label>
          <div className={buscador.filaUbicacion}>
            <BotonIcono icono="gps" etiqueta="Usar mi ubicación actual" />
            <input
              className={claseControl}
              placeholder="Calle y número, barrio o ciudad"
              readOnly
              value={conCaret(busqueda, 'buscarUbicacion')}
              style={estilo('buscarUbicacion')}
            />
            <BotonIcono icono="buscar" etiqueta="Buscar" />
          </div>
          <p className={buscador.ayuda}>Escribí la dirección y apretá Enter.</p>
          {resultados && (
            <ul className={buscador.resultadosLugar}>
              {resultados.map((l) => (
                <li key={l.nombre}>
                  <button type="button">
                    <strong>{l.nombre}</strong>
                    <span>{l.descripcion}</span>
                  </button>
                </li>
              ))}
              <li className={buscador.atribucion}>Direcciones: © colaboradores de OpenStreetMap</li>
            </ul>
          )}
          {ubicacion && (
            <p className={buscador.elegido}>
              <Icono nombre="pin" tamano={18} />
              <span>
                {ubicacion.nombre}{' '}
                <small>
                  ({ubicacion.lat.toFixed(4)}, {ubicacion.lng.toFixed(4)})
                </small>
              </span>
              <span className={buscador.quitar} style={{ flex: 'none' }}>
                <Icono nombre="x" tamano={16} />
              </span>
            </p>
          )}
        </div>
        {!ubicacion && (
          <div
            style={{
              height: 180,
              borderRadius: 'var(--radio-tarjeta)',
              overflow: 'hidden',
              border: '1px solid var(--color-borde-suave)',
            }}
          >
            <MapaEstilizado trazo={0} pines={[]} conRecorrido={false} />
          </div>
        )}

        <div className={pub.grilla}>
          <Campo etiqueta="Tipo de conector">
            {(p) => (
              <div style={{ position: 'relative' }}>
                <select
                  {...p}
                  className={claseControl}
                  value={conector}
                  onChange={() => undefined}
                  style={estilo('conector')}
                >
                  {CONECTORES_OPCIONES.map((c) => (
                    <option key={c.valor} value={c.valor}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
                {conectorDesplegado && (
                  <ListaDesplegada
                    grupos={[{ opciones: CONECTORES_OPCIONES.map((c) => c.nombre) }]}
                    resaltada={nombreConector(conector)}
                  />
                )}
              </div>
            )}
          </Campo>
          <Campo etiqueta="Potencia (kW)">
            {(p) => (
              <input
                {...p}
                className={claseControl}
                placeholder="Ej: 22"
                readOnly
                value={conCaret(potencia, 'potencia')}
                style={estilo('potencia')}
              />
            )}
          </Campo>
          <Campo etiqueta="Precio por kWh (ARS)">
            {(p) => (
              <input
                {...p}
                className={claseControl}
                placeholder="Ej: 350"
                readOnly
                value={conCaret(precio, 'precio')}
                style={estilo('precio')}
              />
            )}
          </Campo>
        </div>

        <fieldset className={pub.franjas}>
          <legend>Disponibilidad horaria</legend>
          <label className={pub.check}>
            <input type="checkbox" checked={false} readOnly />
            Disponible 24/7
          </label>
          {franjas.map((f, i) => (
            <div key={f.dia} className={pub.franja} style={entradaFranja(i)}>
              <Campo etiqueta="Día">
                {(p) => (
                  <select {...p} className={claseControl} value={f.dia} onChange={() => undefined}>
                    <option value={f.dia}>{f.dia}</option>
                  </select>
                )}
              </Campo>
              <Campo etiqueta="Desde">
                {(p) => (
                  <input
                    {...p}
                    className={claseControl}
                    readOnly
                    value={i === 0 ? conCaret(f.desde, 'desde') : f.desde}
                    style={i === 0 ? estilo('desde') : undefined}
                  />
                )}
              </Campo>
              <Campo etiqueta="Hasta">
                {(p) => (
                  <input
                    {...p}
                    className={claseControl}
                    readOnly
                    value={i === 0 ? conCaret(f.hasta, 'hasta') : f.hasta}
                    style={i === 0 ? estilo('hasta') : undefined}
                  />
                )}
              </Campo>
              <BotonIcono icono="basura" etiqueta={`Quitar franja ${i + 1}`} />
            </div>
          ))}
          <div className={pub.botonesFranja}>
            <Boton variante="secundario" chico icono="mas">
              Agregar franja
            </Boton>
            <Boton variante="texto" chico>
              Mismo horario todos los días
            </Boton>
          </div>
        </fieldset>

        <Boton type="button" anchoCompleto cargando={enviando}>
          Publicar
        </Boton>
      </form>
    </MarcoApp>
  );
}

export function PantallaMisCargadores({
  nombre,
  conector,
  potenciaKw,
  precioKwh,
  franjas,
  resaltado,
}: {
  nombre: string;
  conector: string;
  potenciaKw: number;
  precioKwh: number;
  franjas: number;
  resaltado: number;
}) {
  return (
    <MarcoApp seccion="publicar">
      <Cabecera
        titulo="Mis cargadores"
        volver="/"
        accion={<EnlaceBoton a="/publicar">Publicar</EnlaceBoton>}
      />
      <ul className={pub.lista}>
        <li
          style={{
            borderRadius: 'var(--radio-tarjeta)',
            boxShadow: `0 0 0 ${3 * resaltado}px var(--color-primario)`,
          }}
        >
          <Tarjeta>
            <div className={pub.cabeceraTarjeta}>
              <h2 className={pub.nombre}>{nombre}</h2>
              <Insignia tono="exito">Activo</Insignia>
            </div>
            <p className={pub.datos}>
              {nombreConector(conector)} · {kw(potenciaKw)} · {pesos(precioKwh)}/kWh · {franjas}{' '}
              franjas
            </p>
            <div className={pub.acciones}>
              <EnlaceBoton a="/editar" variante="secundario">
                Editar
              </EnlaceBoton>
              <Boton variante="secundario">Desactivar</Boton>
              <Boton variante="texto">Eliminar</Boton>
            </div>
          </Tarjeta>
        </li>
      </ul>
      <h2 className={pub.seccion}>Reservas recibidas</h2>
      <p className={pub.datos}>Todavía no recibiste reservas.</p>
    </MarcoApp>
  );
}
