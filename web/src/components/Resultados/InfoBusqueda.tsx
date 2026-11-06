// Piezas compartidas por las dos vistas de resultados (mapa y lista): resumen de la búsqueda, avisos,
// "Guardar esta ruta", estado sin resultados y cargadores descartados.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { mensajeDeError } from '../../api/cliente';
import { apiFavoritos } from '../../api/endpoints';
import type { ResultadoRecomendacion } from '../../api/tipos';
import { useSesion } from '../../auth/Sesion';
import type { Busqueda } from '../../dominio/busqueda';
import { km } from '../../dominio/formato';
import { Alerta, Boton, EnlaceBoton, Vacio } from '../ui';
import s from './Resultados.module.css';

const URGENCIA: Record<string, string> = { baja: 'Baja', media: 'Media', alta: 'Alta' };
const MOTIVOS: Record<string, string> = {
  CONECTOR_INCOMPATIBLE: 'conector incompatible',
  FUERA_DE_AUTONOMIA: 'fuera de autonomía',
  SIN_DISPONIBILIDAD: 'sin disponibilidad',
};

export function ResumenBusqueda({
  r,
  busqueda,
}: {
  r: ResultadoRecomendacion;
  busqueda: Busqueda;
}) {
  return (
    <p className={s.resumen}>
      <span>
        <strong>{r.vehiculo.descripcion}</strong>
      </span>
      <span>
        Batería <strong>{busqueda.bateriaPct}%</strong>
      </span>
      <span>
        Urgencia <strong>{URGENCIA[r.urgencia]}</strong>
      </span>
      <span>
        Autonomía actual <strong>{km(r.autonomiaActualKm)}</strong>
      </span>
    </p>
  );
}

export function AvisosBusqueda({ r }: { r: ResultadoRecomendacion }) {
  return (
    <>
      {r.advertencias.map((a) => (
        <Alerta key={a} tipo="aviso">
          <p>{a}</p>
        </Alerta>
      ))}
    </>
  );
}

export function SinResultados({ r }: { r: ResultadoRecomendacion }) {
  if (!r.sinResultados) return null;
  return (
    <Vacio titulo="No encontramos cargadores para esta búsqueda" icono="rayo">
      <p>{r.sinResultados.mensaje}</p>
      <EnlaceBoton a="/" variante="secundario">
        Cambiar la búsqueda
      </EnlaceBoton>
    </Vacio>
  );
}

export function Descartados({ r }: { r: ResultadoRecomendacion }) {
  if (r.descartados.length === 0) return null;
  const n = r.descartados.length;
  return (
    <details className={s.descartados}>
      <summary>
        {n} cargador{n === 1 ? '' : 'es'} descartado{n === 1 ? '' : 's'}
      </summary>
      <ul>
        {r.descartados.map((d) => (
          <li key={d.cargadorId}>
            {d.nombre}: {MOTIVOS[d.motivo] ?? d.motivo}. {d.detalle}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function GuardarRuta({ busqueda }: { busqueda: Busqueda }) {
  const { perfil } = useSesion();
  const queryClient = useQueryClient();
  const [guardada, setGuardada] = useState(false);
  const guardar = useMutation({
    mutationFn: () =>
      apiFavoritos.guardarRuta({
        nombre: `${busqueda.origenNombre ?? 'Origen'} → ${busqueda.destinoNombre ?? 'Destino'}`,
        origen: busqueda.origen,
        destino: busqueda.destino!,
      }),
    onSuccess: () => {
      setGuardada(true);
      void queryClient.invalidateQueries({ queryKey: ['rutas-guardadas'] });
    },
  });
  if (!perfil || busqueda.modo !== 'ruta' || !busqueda.destino) return null;
  return (
    <div className={s.acciones}>
      <Boton
        variante="secundario"
        chico
        icono="ruta"
        disabled={guardada}
        cargando={guardar.isPending}
        onClick={() => guardar.mutate()}
      >
        {guardada ? 'Ruta guardada' : 'Guardar esta ruta'}
      </Boton>
      {guardar.isError && <span role="alert">{mensajeDeError(guardar.error)}</span>}
    </div>
  );
}
