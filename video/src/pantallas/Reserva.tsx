// Detalle del cargador con el formulario de reserva (web/src/pages/Detalle) y "Mis reservas"
// (web/src/pages/Reservas), con sus CSS Modules y componentes reales. Los campos de fecha y hora se muestran
// con formato argentino (como los ve el usuario); el navegador del render usaría el formato de EE. UU.
import type { CSSProperties, ReactNode } from 'react';
import type { Recomendacion } from '../../../web/src/api/tipos';
import {
  Alerta,
  Boton,
  BotonIcono,
  Cabecera,
  Campo,
  claseControl,
  EnlaceBoton,
  Insignia,
  Tarjeta,
} from '../../../web/src/components/ui';
import {
  disponibilidad,
  kw,
  minutos,
  nombreConector,
  pesos,
} from '../../../web/src/dominio/formato';
import det from '../../../web/src/pages/Detalle/Detalle.module.css';
import res from '../../../web/src/pages/Reservas/Reservas.module.css';
import { MarcoApp } from './MarcoApp';

const CRITERIOS = [
  { clave: 'distancia', nombre: 'Distancia', unidad: (v: number) => `${v.toFixed(1)} km` },
  { clave: 'espera', nombre: 'Espera', unidad: (v: number) => minutos(v) },
  { clave: 'carga', nombre: 'Tiempo de carga', unidad: (v: number) => minutos(v) },
  { clave: 'costo', nombre: 'Costo', unidad: (v: number) => pesos(v) },
] as const;

const foco: CSSProperties = {
  outline: 'var(--foco-anillo)',
  outlineOffset: 'var(--foco-separacion)',
};

/** Fila de datos que se puede resaltar mientras se la "lee". */
function Dato({ dt, dd, resaltado = 0 }: { dt: string; dd: ReactNode; resaltado?: number }) {
  return (
    <div
      style={{
        margin: '-4px -8px',
        padding: '4px 8px',
        borderRadius: 8,
        background: `rgb(12 127 87 / ${0.12 * resaltado})`,
      }}
    >
      <dt>{dt}</dt>
      <dd>{dd}</dd>
    </div>
  );
}

export type EstadoFormulario = 'editando' | 'enviando' | 'hecha';

export function PantallaDetalleReserva({
  rec,
  resaltados,
  desplazamiento,
  desde,
  hasta,
  enfocado,
  estado,
}: {
  rec: Recomendacion;
  /** Intensidad del resaltado por fila: dirección, conector, potencia, costo. */
  resaltados: { direccion: number; conector: number; potencia: number; costo: number };
  desplazamiento: number;
  desde: string;
  hasta: string;
  enfocado: 'desde' | 'hasta' | null;
  estado: EstadoFormulario;
}) {
  const c = rec.cargador;
  const m = rec.metricas;
  return (
    <MarcoApp seccion="home" desplazamiento={desplazamiento}>
      <div className={det.pagina}>
        <Cabecera
          titulo={c.nombre}
          volver
          accion={<BotonIcono icono="corazon" etiqueta="Agregar a favoritos" />}
        />
        <div className={det.columnas}>
          <div className={det.columna}>
            <Tarjeta suave>
              <dl className={det.datos}>
                <Dato dt="Dirección" dd={c.direccion} resaltado={resaltados.direccion} />
                <Dato
                  dt="Tipo"
                  dd={c.tipo === 'privado' ? 'Privado (red colaborativa)' : 'Público'}
                />
                <Dato
                  dt="Conector"
                  dd={nombreConector(c.tipoConector)}
                  resaltado={resaltados.conector}
                />
                <Dato dt="Potencia" dd={kw(c.potenciaKw)} resaltado={resaltados.potencia} />
                <Dato dt="Precio" dd={`${pesos(c.precioKwh)} por kWh`} />
                <Dato dt="Disponibilidad" dd={disponibilidad(m.esperaMin)} />
                <Dato
                  dt="Tiempo estimado"
                  dd={`${minutos(m.viajeMin)} de viaje + ${minutos(m.cargaMin)} de carga`}
                />
                <Dato
                  dt="Costo estimado"
                  dd={`${pesos(m.costoEstimado)} (${m.energiaKwh.toFixed(1)} kWh)`}
                  resaltado={resaltados.costo}
                />
              </dl>
            </Tarjeta>

            <details className={det.porQue} open>
              <summary>¿Por qué lo recomendamos?</summary>
              <p className={det.texto}>
                Puntaje <strong>{Math.round(rec.score)}/100</strong>. Cada criterio suma puntos
                según su peso (que depende de tu urgencia) y de qué tan bien queda este cargador
                frente a los demás candidatos.
              </p>
              <ul className={det.barras}>
                {CRITERIOS.map(({ clave, nombre, unidad }) => {
                  const d = rec.desglose[clave];
                  const maximo = d.peso * 100;
                  return (
                    <li key={clave}>
                      <div className={det.barraTexto}>
                        <span>
                          {nombre} <small>({unidad(d.valor)})</small>
                        </span>
                        <span>
                          {d.aporte.toFixed(0)} de {maximo.toFixed(0)} pts
                        </span>
                      </div>
                      <div className={det.barra}>
                        <span style={{ width: `${(d.aporte / maximo) * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </details>
          </div>

          <div className={det.columna}>
            {estado === 'hecha' ? (
              <Tarjeta destacada>
                <h2 className={det.subtitulo}>Reserva pendiente</h2>
                <p className={det.texto}>
                  Hoy, {desde} a {hasta} hs. El dueño del cargador tiene que aceptarla.
                </p>
                <EnlaceBoton a="/reservas" variante="secundario" anchoCompleto>
                  Ver mis reservas
                </EnlaceBoton>
              </Tarjeta>
            ) : (
              <form className={det.formulario}>
                <h2 className={det.subtitulo}>Horario de reserva</h2>
                <p className={det.texto}>
                  Precargado con la hora estimada de llegada y la duración de la carga.
                </p>
                <Campo etiqueta="Fecha">
                  {(p) => <input {...p} className={claseControl} readOnly value="06/11/2026" />}
                </Campo>
                <div className={det.horas}>
                  <Campo etiqueta="Desde">
                    {(p) => (
                      <input
                        {...p}
                        className={claseControl}
                        readOnly
                        value={desde}
                        style={enfocado === 'desde' ? foco : undefined}
                      />
                    )}
                  </Campo>
                  <Campo etiqueta="Hasta">
                    {(p) => (
                      <input
                        {...p}
                        className={claseControl}
                        readOnly
                        value={hasta}
                        style={enfocado === 'hasta' ? foco : undefined}
                      />
                    )}
                  </Campo>
                </div>
                <Alerta tipo="aviso">
                  <p>
                    Es un cargador privado: la reserva queda pendiente hasta que el dueño la acepte.
                  </p>
                </Alerta>
                <Boton type="button" anchoCompleto cargando={estado === 'enviando'}>
                  Confirmar reserva
                </Boton>
              </form>
            )}
          </div>
        </div>
      </div>
    </MarcoApp>
  );
}

export interface ReservaVideo {
  id: string;
  cargador: string;
  cuando: string;
  estado: 'confirmada' | 'pendiente' | 'cancelada';
}

const TONO = { confirmada: 'exito', pendiente: 'pendiente', cancelada: 'atenuado' } as const;
const NOMBRE_ESTADO = { confirmada: 'Confirmada', pendiente: 'Pendiente', cancelada: 'Cancelada' };

/** Igual que TarjetaReserva de la app. */
function TarjetaReserva({ r }: { r: ReservaVideo }) {
  const cancelada = r.estado === 'cancelada';
  return (
    <Tarjeta className={cancelada ? res.cancelada : undefined}>
      <div className={res.cabecera}>
        <h2 className={res.nombre}>{r.cargador}</h2>
        <Insignia tono={TONO[r.estado]}>{NOMBRE_ESTADO[r.estado]}</Insignia>
      </div>
      <p className={res.datos}>{r.cuando}</p>
      {!cancelada && (
        <div className={res.accion}>
          <Boton variante="texto" chico>
            Cancelar
          </Boton>
        </div>
      )}
    </Tarjeta>
  );
}

export function PantallaMisReservas({
  reservas,
  entrada,
  resaltada,
}: {
  reservas: readonly ReservaVideo[];
  entrada: (i: number) => CSSProperties;
  /** Intensidad del resaltado de la primera reserva (la recién hecha). */
  resaltada: number;
}) {
  return (
    <MarcoApp seccion="reservas">
      <Cabecera titulo="Mis reservas" volver="/" />
      <ul className={res.lista}>
        {reservas.map((r, i) => (
          <li
            key={r.id}
            style={{
              ...entrada(i),
              borderRadius: 'var(--radio-tarjeta)',
              boxShadow: i === 0 ? `0 0 0 ${3 * resaltada}px var(--color-primario)` : undefined,
            }}
          >
            <TarjetaReserva r={r} />
          </li>
        ))}
      </ul>
    </MarcoApp>
  );
}
