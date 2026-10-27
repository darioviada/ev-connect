// /mis-cargadores — gestión de los cargadores propios (activar/desactivar, editar, eliminar) y respuesta
// a las reservas pendientes (aceptar o rechazar, D-020).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mensajeDeError } from '../../api/cliente';
import { apiCargadores, apiReservas } from '../../api/endpoints';
import {
  Alerta,
  Boton,
  Cabecera,
  Cargando,
  EnlaceBoton,
  Insignia,
  Tarjeta,
  Vacio,
} from '../../components/ui';
import { kw, nombreConector, pesos } from '../../dominio/formato';
import { TarjetaReserva } from '../Reservas/Reservas';
import s from './Publicar.module.css';

export function MisCargadores() {
  const queryClient = useQueryClient();
  const cargadores = useQuery({ queryKey: ['mis-cargadores'], queryFn: apiCargadores.mios });
  const recibidas = useQuery({
    queryKey: ['mis-cargadores', 'reservas'],
    queryFn: apiReservas.recibidas,
  });
  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['mis-cargadores'] });

  const cambiarEstado = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: 'activo' | 'inactivo' }) =>
      apiCargadores.editar(id, { estado }),
    onSuccess: refrescar,
  });
  const eliminar = useMutation({ mutationFn: apiCargadores.eliminar, onSuccess: refrescar });
  const responder = useMutation({
    mutationFn: ({ id, aceptar }: { id: string; aceptar: boolean }) =>
      aceptar ? apiReservas.aceptar(id) : apiReservas.rechazar(id),
    onSuccess: refrescar,
  });

  const error = cambiarEstado.error ?? eliminar.error ?? responder.error;
  const pendientes = recibidas.data?.items.filter((r) => r.estado === 'pendiente') ?? [];
  const otras = recibidas.data?.items.filter((r) => r.estado !== 'pendiente') ?? [];

  return (
    <>
      <Cabecera
        titulo="Mis cargadores"
        volver="/"
        accion={<EnlaceBoton a="/publicar">Publicar</EnlaceBoton>}
      />
      {error && (
        <Alerta>
          <p>{mensajeDeError(error)}</p>
        </Alerta>
      )}
      {cargadores.isPending && <Cargando />}
      {cargadores.data?.items.length === 0 && (
        <Vacio titulo="Todavía no publicaste cargadores" icono="rayo">
          <p>Compartí tu cargador con la red colaborativa.</p>
          <EnlaceBoton a="/publicar">Publicar cargador</EnlaceBoton>
        </Vacio>
      )}
      <ul className={s.lista}>
        {cargadores.data?.items.map((c) => (
          <li key={c.id}>
            <Tarjeta>
              <div className={s.cabeceraTarjeta}>
                <h2 className={s.nombre}>{c.nombre}</h2>
                <Insignia tono={c.estado === 'activo' ? 'exito' : 'atenuado'}>
                  {c.estado === 'activo' ? 'Activo' : 'Inactivo'}
                </Insignia>
              </div>
              <p className={s.datos}>
                {nombreConector(c.tipoConector)} · {kw(c.potenciaKw)} · {pesos(c.precioKwh)}/kWh ·{' '}
                {c.disponibilidad.length === 0 ? '24/7' : `${c.disponibilidad.length} franjas`}
                {c.reservasPendientes > 0 && ` · ${c.reservasPendientes} reserva(s) pendiente(s)`}
              </p>
              <div className={s.acciones}>
                <EnlaceBoton a={`/mis-cargadores/${c.id}/editar`} variante="secundario">
                  Editar
                </EnlaceBoton>
                <Boton
                  variante="secundario"
                  onClick={() =>
                    cambiarEstado.mutate({
                      id: c.id,
                      estado: c.estado === 'activo' ? 'inactivo' : 'activo',
                    })
                  }
                >
                  {c.estado === 'activo' ? 'Desactivar' : 'Activar'}
                </Boton>
                <Boton
                  variante="texto"
                  onClick={() => {
                    if (window.confirm(`¿Eliminar ${c.nombre}? Esta acción no se puede deshacer.`))
                      eliminar.mutate(c.id);
                  }}
                >
                  Eliminar
                </Boton>
              </div>
            </Tarjeta>
          </li>
        ))}
      </ul>

      <h2 className={s.seccion}>Reservas recibidas</h2>
      {recibidas.isPending && <Cargando />}
      {recibidas.data?.items.length === 0 && (
        <p className={s.datos}>Todavía no recibiste reservas.</p>
      )}
      <ul className={s.lista}>
        {[...pendientes, ...otras].map((r) => (
          <li key={r.id}>
            <TarjetaReserva
              reserva={r}
              accion={
                r.estado === 'pendiente' && (
                  <>
                    <Boton chico onClick={() => responder.mutate({ id: r.id, aceptar: true })}>
                      Aceptar
                    </Boton>
                    <Boton
                      chico
                      variante="secundario"
                      onClick={() => responder.mutate({ id: r.id, aceptar: false })}
                    >
                      Rechazar
                    </Boton>
                  </>
                )
              }
            />
          </li>
        ))}
      </ul>
    </>
  );
}
