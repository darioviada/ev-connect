// /cargadores/:id — Detalle y reserva (HU-010). Si se llega desde una búsqueda (?b=…), muestra las métricas
// de la recomendación, "¿Por qué lo recomendamos?" y precarga la reserva en la hora estimada de llegada.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router';
import { ApiError, mensajeDeError } from '../../api/cliente';
import { apiCargadores, apiFavoritos, apiReservas } from '../../api/endpoints';
import type { Criterio, Recomendacion, Reserva } from '../../api/tipos';
import { useSesion } from '../../auth/Sesion';
import {
  Alerta,
  Boton,
  BotonIcono,
  Cabecera,
  Campo,
  Cargando,
  claseControl,
  EnlaceBoton,
  Tarjeta,
  Vacio,
} from '../../components/ui';
import { decodificarBusqueda } from '../../dominio/busqueda';
import {
  agruparFranjas,
  disponibilidad,
  ESTADOS_RESERVA,
  fechaCorta,
  fechaLocal,
  kw,
  minutos,
  nombreConector,
  pesos,
} from '../../dominio/formato';
import { useFavoritos, useRecomendaciones } from '../../hooks/consultas';
import s from './Detalle.module.css';

const MapaCargador = lazy(() => import('./MapaCargador'));

const CRITERIOS: { clave: Criterio; nombre: string; unidad: (v: number) => string }[] = [
  { clave: 'distancia', nombre: 'Distancia', unidad: (v) => `${v.toFixed(1)} km` },
  { clave: 'espera', nombre: 'Espera', unidad: (v) => minutos(v) },
  { clave: 'carga', nombre: 'Tiempo de carga', unidad: (v) => minutos(v) },
  { clave: 'costo', nombre: 'Costo', unidad: (v) => pesos(v) },
];

/** Próxima hora en punto (si no hay una recomendación para precargar). */
function horarioPorDefecto() {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  const h = String(d.getHours()).padStart(2, '0');
  const fin = String(Math.min(d.getHours() + 1, 23)).padStart(2, '0');
  return {
    fecha: fechaLocal(d),
    horaInicio: `${h}:00`,
    horaFin: fin === h ? '23:59' : `${fin}:00`,
  };
}

export function DetalleCargador() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const b = params.get('b');
  const busqueda = decodificarBusqueda(b);
  const recs = useRecomendaciones(busqueda);
  const rec = recs.data?.recomendaciones.find((r) => r.cargador.id === id);
  const detalle = useQuery({
    queryKey: ['cargador', id],
    queryFn: () => apiCargadores.detalle(id),
  });

  if (detalle.isPending) return <Cargando />;
  if (detalle.isError) {
    return (
      <Vacio titulo="No pudimos mostrar este cargador">
        <p>{mensajeDeError(detalle.error)}</p>
      </Vacio>
    );
  }
  const c = detalle.data;
  const volver = b ? `/resultados?b=${b}` : true;

  return (
    <div className={s.pagina}>
      <Cabecera titulo={c.nombre} volver={volver} accion={<BotonFavorito cargadorId={c.id} />} />

      <div className={s.columnas}>
        <div className={s.columna}>
          <Tarjeta suave>
            <dl className={s.datos}>
              <div>
                <dt>Dirección</dt>
                <dd>{c.direccion ?? 'Sin dirección'}</dd>
              </div>
              <div>
                <dt>Tipo</dt>
                <dd>{c.tipo === 'privado' ? 'Privado (red colaborativa)' : 'Público'}</dd>
              </div>
              <div>
                <dt>Conector</dt>
                <dd>{nombreConector(c.tipoConector)}</dd>
              </div>
              <div>
                <dt>Potencia</dt>
                <dd>{kw(c.potenciaKw)}</dd>
              </div>
              <div>
                <dt>Precio</dt>
                <dd>{pesos(c.precioKwh)} por kWh</dd>
              </div>
              {rec && (
                <>
                  <div>
                    <dt>Disponibilidad</dt>
                    <dd>{disponibilidad(rec.metricas.esperaMin)}</dd>
                  </div>
                  <div>
                    <dt>Tiempo estimado</dt>
                    <dd>
                      {minutos(rec.metricas.viajeMin)} de viaje + {minutos(rec.metricas.cargaMin)}{' '}
                      de carga
                    </dd>
                  </div>
                  <div>
                    <dt>Costo estimado</dt>
                    <dd>
                      {pesos(rec.metricas.costoEstimado)} ({rec.metricas.energiaKwh.toFixed(1)} kWh)
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </Tarjeta>

          {rec && <PorQue rec={rec} />}

          <section>
            <h2 className={s.subtitulo}>Horarios</h2>
            {c.disponibilidad.length === 0 ? (
              <p className={s.texto}>Disponible las 24 horas, todos los días.</p>
            ) : (
              <ul className={s.franjas}>
                {agruparFranjas(c.disponibilidad).map((g) => (
                  <li key={g.dias + g.horario}>
                    <span>{g.dias}</span>
                    <span>{g.horario}</span>
                  </li>
                ))}
              </ul>
            )}
            {c.ocupacion.length > 0 && (
              <>
                <h3 className={s.subtitulo3}>Ya reservado (próximos días)</h3>
                <ul className={s.franjas}>
                  {c.ocupacion.map((o) => (
                    <li key={`${o.fecha}-${o.horaInicio}`}>
                      <span>{fechaCorta(o.fecha)}</span>
                      <span>
                        {o.horaInicio} a {o.horaFin}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>

        <div className={s.columna}>
          <FormularioReserva cargadorId={c.id} privado={c.tipo === 'privado'} rec={rec} />
          <Suspense fallback={null}>
            <MapaCargador posicion={c.ubicacion} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function PorQue({ rec }: { rec: Recomendacion }) {
  return (
    <details className={s.porQue} open>
      <summary>¿Por qué lo recomendamos?</summary>
      <p className={s.texto}>
        Puntaje <strong>{Math.round(rec.score)}/100</strong>. Cada criterio suma puntos según su
        peso (que depende de tu urgencia) y de qué tan bien queda este cargador frente a los demás
        candidatos.
      </p>
      <ul className={s.barras}>
        {CRITERIOS.map(({ clave, nombre, unidad }) => {
          const d = rec.desglose[clave];
          const maximo = d.peso * 100;
          return (
            <li key={clave}>
              <div className={s.barraTexto}>
                <span>
                  {nombre} <small>({unidad(d.valor)})</small>
                </span>
                <span>
                  {d.aporte.toFixed(0)} de {maximo.toFixed(0)} pts
                </span>
              </div>
              <div
                className={s.barra}
                role="meter"
                aria-label={`${nombre}: ${d.aporte.toFixed(0)} de ${maximo.toFixed(0)} puntos`}
                aria-valuemin={0}
                aria-valuemax={maximo}
                aria-valuenow={d.aporte}
              >
                <span style={{ width: `${maximo > 0 ? (d.aporte / maximo) * 100 : 0}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      {rec.advertencias.length > 0 && (
        <ul className={s.advertencias}>
          {rec.advertencias.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
    </details>
  );
}

function FormularioReserva({
  cargadorId,
  privado,
  rec,
}: {
  cargadorId: string;
  privado: boolean;
  rec: Recomendacion | undefined;
}) {
  const { perfil } = useSesion();
  const ubicacion = useLocation();
  const queryClient = useQueryClient();
  const inicial = rec?.metricas.horarioCarga ?? horarioPorDefecto();
  const [fecha, setFecha] = useState(inicial.fecha);
  const [horaInicio, setHoraInicio] = useState(inicial.horaInicio);
  const [horaFin, setHoraFin] = useState(inicial.horaFin);
  const [hecha, setHecha] = useState<Reserva | null>(null);

  const reservar = useMutation({
    mutationFn: () => apiReservas.crear({ cargadorId, fecha, horaInicio, horaFin }),
    onSuccess: (r) => {
      setHecha(r);
      void queryClient.invalidateQueries({ queryKey: ['mis-reservas'] });
      void queryClient.invalidateQueries({ queryKey: ['cargador', cargadorId] });
      void queryClient.invalidateQueries({ queryKey: ['recomendaciones'] });
    },
  });

  if (!perfil) {
    return (
      <Tarjeta>
        <h2 className={s.subtitulo}>Reservar</h2>
        <p className={s.texto}>Para reservar este cargador necesitás iniciar sesión.</p>
        <EnlaceBoton
          a={`/login?volver=${encodeURIComponent(ubicacion.pathname + ubicacion.search)}`}
          anchoCompleto
        >
          Iniciar sesión para reservar
        </EnlaceBoton>
      </Tarjeta>
    );
  }

  if (hecha) {
    return (
      <Tarjeta destacada>
        <h2 className={s.subtitulo}>Reserva {ESTADOS_RESERVA[hecha.estado]?.toLowerCase()}</h2>
        <p className={s.texto}>
          {fechaCorta(hecha.fecha)}, {hecha.horaInicio} a {hecha.horaFin} hs.
          {hecha.estado === 'pendiente' && ' El dueño del cargador tiene que aceptarla.'}
        </p>
        <EnlaceBoton a="/reservas" variante="secundario" anchoCompleto>
          Ver mis reservas
        </EnlaceBoton>
      </Tarjeta>
    );
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    reservar.mutate();
  }

  const conflicto =
    reservar.error instanceof ApiError && reservar.error.code === 'RESERVA_SOLAPADA';
  return (
    <form className={s.formulario} onSubmit={enviar} aria-labelledby="titulo-reserva">
      <h2 id="titulo-reserva" className={s.subtitulo}>
        Horario de reserva
      </h2>
      {rec && (
        <p className={s.texto}>
          Precargado con la hora estimada de llegada y la duración de la carga.
        </p>
      )}
      <Campo etiqueta="Fecha">
        {(p) => (
          <input
            {...p}
            type="date"
            className={claseControl}
            required
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        )}
      </Campo>
      <div className={s.horas}>
        <Campo etiqueta="Desde">
          {(p) => (
            <input
              {...p}
              type="time"
              className={claseControl}
              required
              value={horaInicio}
              onChange={(e) => setHoraInicio(e.target.value)}
            />
          )}
        </Campo>
        <Campo etiqueta="Hasta">
          {(p) => (
            <input
              {...p}
              type="time"
              className={claseControl}
              required
              value={horaFin}
              onChange={(e) => setHoraFin(e.target.value)}
            />
          )}
        </Campo>
      </div>
      {privado && (
        <Alerta tipo="aviso">
          <p>Es un cargador privado: la reserva queda pendiente hasta que el dueño la acepte.</p>
        </Alerta>
      )}
      {reservar.isError && (
        <Alerta>
          <p>
            {conflicto
              ? 'Ese horario ya está reservado en este cargador. Probá con otro horario.'
              : mensajeDeError(reservar.error)}
          </p>
        </Alerta>
      )}
      <Boton type="submit" anchoCompleto cargando={reservar.isPending}>
        Confirmar reserva
      </Boton>
      <p className={s.texto}>
        <Link to="/reservas">Ver mis reservas</Link>
      </p>
    </form>
  );
}

function BotonFavorito({ cargadorId }: { cargadorId: string }) {
  const { perfil } = useSesion();
  const queryClient = useQueryClient();
  const favoritos = useFavoritos();
  const esFavorito = favoritos.data?.some((f) => f.id === cargadorId) ?? false;
  const cambiar = useMutation({
    mutationFn: async () => {
      if (esFavorito) await apiFavoritos.quitar(cargadorId);
      else await apiFavoritos.agregar(cargadorId);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['favoritos'] }),
  });
  if (!perfil) return null;
  return (
    <BotonIcono
      icono="corazon"
      etiqueta={esFavorito ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      aria-pressed={esFavorito}
      className={esFavorito ? s.favorito : undefined}
      onClick={() => cambiar.mutate()}
      disabled={cambiar.isPending}
    />
  );
}
