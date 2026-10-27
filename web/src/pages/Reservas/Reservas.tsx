// /reservas — Mis reservas (HU-010): confirmada (verde), pendiente (ámbar), cancelada (atenuada); cancelar.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mensajeDeError } from '../../api/cliente';
import { apiReservas } from '../../api/endpoints';
import type { Reserva } from '../../api/tipos';
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
import { ESTADOS_RESERVA, fechaCorta } from '../../dominio/formato';
import s from './Reservas.module.css';

const TONO = { confirmada: 'exito', pendiente: 'pendiente', cancelada: 'atenuado' } as const;

export function Reservas() {
  const queryClient = useQueryClient();
  const reservas = useQuery({ queryKey: ['mis-reservas'], queryFn: apiReservas.mias });
  const cancelar = useMutation({
    mutationFn: (id: string) => apiReservas.cancelar(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mis-reservas'] }),
  });

  return (
    <>
      <Cabecera titulo="Mis reservas" volver="/" />
      {reservas.isPending && <Cargando />}
      {reservas.isError && (
        <Alerta>
          <p>{mensajeDeError(reservas.error)}</p>
        </Alerta>
      )}
      {cancelar.isError && (
        <Alerta>
          <p>{mensajeDeError(cancelar.error)}</p>
        </Alerta>
      )}
      {reservas.data?.items.length === 0 && (
        <Vacio titulo="No tenés reservas" icono="calendario">
          <EnlaceBoton a="/">Buscar un cargador</EnlaceBoton>
        </Vacio>
      )}
      <ul className={s.lista}>
        {reservas.data?.items.map((r) => (
          <li key={r.id}>
            <TarjetaReserva
              reserva={r}
              accion={
                r.puedeCancelar && (
                  <Boton
                    variante="texto"
                    chico
                    cargando={cancelar.isPending && cancelar.variables === r.id}
                    onClick={() => {
                      if (window.confirm(`¿Cancelar la reserva en ${r.cargador.nombre}?`))
                        cancelar.mutate(r.id);
                    }}
                  >
                    Cancelar
                  </Boton>
                )
              }
            />
          </li>
        ))}
      </ul>
    </>
  );
}

export function TarjetaReserva({
  reserva: r,
  accion,
}: {
  reserva: Reserva;
  accion?: React.ReactNode;
}) {
  const cancelada = r.estado === 'cancelada';
  return (
    <Tarjeta className={cancelada ? s.cancelada : undefined}>
      <div className={s.cabecera}>
        <h2 className={s.nombre}>{r.cargador.nombre}</h2>
        <Insignia tono={TONO[r.estado]}>{ESTADOS_RESERVA[r.estado]}</Insignia>
      </div>
      <p className={s.datos}>
        {fechaCorta(r.fecha)}, {r.horaInicio} a {r.horaFin} hs
        {r.reservadaPor ? ` · ${r.reservadaPor}` : ''}
      </p>
      {accion && <div className={s.accion}>{accion}</div>}
    </Tarjeta>
  );
}
