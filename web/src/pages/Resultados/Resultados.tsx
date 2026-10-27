// /resultados — Cargadores recomendados (HU-008 y HU-009), en lista.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { mensajeDeError } from '../../api/cliente';
import { apiFavoritos } from '../../api/endpoints';
import { useSesion } from '../../auth/Sesion';
import { TarjetaRecomendacion } from '../../components/Resultados/TarjetaRecomendacion';
import s from '../../components/Resultados/Resultados.module.css';
import {
  Alerta,
  Boton,
  BotonIcono,
  Cabecera,
  Cargando,
  EnlaceBoton,
  Vacio,
} from '../../components/ui';
import { decodificarBusqueda } from '../../dominio/busqueda';
import { km } from '../../dominio/formato';
import { useRecomendaciones } from '../../hooks/consultas';
import { useNavigate } from 'react-router';

const URGENCIA: Record<string, string> = { baja: 'Baja', media: 'Media', alta: 'Alta' };
const MOTIVOS: Record<string, string> = {
  CONECTOR_INCOMPATIBLE: 'conector incompatible',
  FUERA_DE_AUTONOMIA: 'fuera de autonomía',
  SIN_DISPONIBILIDAD: 'sin disponibilidad',
};

export function Resultados() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const b = params.get('b');
  const busqueda = decodificarBusqueda(b);
  const consulta = useRecomendaciones(busqueda);

  if (!busqueda) {
    return (
      <Vacio titulo="No hay una búsqueda para mostrar">
        <EnlaceBoton a="/">Hacer una búsqueda</EnlaceBoton>
      </Vacio>
    );
  }

  const r = consulta.data;
  return (
    <>
      <Cabecera
        titulo="Cargadores recomendados"
        subtitulo="Ordenados según tu búsqueda"
        volver="/"
        accion={
          <BotonIcono
            icono="mapa"
            etiqueta="Ver en el mapa"
            suave
            onClick={() => navigate(`/resultados/mapa?b=${b}`)}
          />
        }
      />

      {consulta.isPending && <Cargando texto="Buscando los mejores cargadores…" />}
      {consulta.isError && (
        <Alerta>
          <p>{mensajeDeError(consulta.error)}</p>
        </Alerta>
      )}

      {r && (
        <>
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
            {busqueda.modo === 'ruta' && (
              <span>
                Ruta{' '}
                <strong>
                  {busqueda.origenNombre ?? 'Origen'} → {busqueda.destinoNombre ?? 'Destino'}
                </strong>
              </span>
            )}
          </p>

          {r.advertencias.map((a) => (
            <Alerta key={a} tipo="aviso">
              <p>{a}</p>
            </Alerta>
          ))}

          {busqueda.modo === 'ruta' && (
            <GuardarRuta
              origenNombre={busqueda.origenNombre}
              destinoNombre={busqueda.destinoNombre}
              origen={busqueda.origen}
              destino={busqueda.destino!}
            />
          )}

          {r.sinResultados ? (
            <Vacio titulo="No encontramos cargadores para esta búsqueda" icono="rayo">
              <p>{r.sinResultados.mensaje}</p>
              <EnlaceBoton a="/" variante="secundario">
                Cambiar la búsqueda
              </EnlaceBoton>
            </Vacio>
          ) : (
            <ul className={s.lista} aria-label="Cargadores recomendados">
              {r.recomendaciones.map((rec) => (
                <li key={rec.cargador.id}>
                  <TarjetaRecomendacion
                    rec={rec}
                    modo={r.modo}
                    enlace={`/cargadores/${rec.cargador.id}?b=${b}`}
                  />
                </li>
              ))}
            </ul>
          )}

          {r.descartados.length > 0 && (
            <details className={s.descartados}>
              <summary>
                {r.descartados.length} cargador{r.descartados.length === 1 ? '' : 'es'} descartado
                {r.descartados.length === 1 ? '' : 's'}
              </summary>
              <ul>
                {r.descartados.map((d) => (
                  <li key={d.cargadorId}>
                    {d.nombre}: {MOTIVOS[d.motivo] ?? d.motivo}. {d.detalle}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </>
  );
}

function GuardarRuta(props: {
  origen: { lat: number; lng: number };
  destino: { lat: number; lng: number };
  origenNombre?: string | undefined;
  destinoNombre?: string | undefined;
}) {
  const { perfil } = useSesion();
  const queryClient = useQueryClient();
  const [guardada, setGuardada] = useState(false);
  const guardar = useMutation({
    mutationFn: () =>
      apiFavoritos.guardarRuta({
        nombre: `${props.origenNombre ?? 'Origen'} → ${props.destinoNombre ?? 'Destino'}`,
        origen: props.origen,
        destino: props.destino,
      }),
    onSuccess: () => {
      setGuardada(true);
      void queryClient.invalidateQueries({ queryKey: ['rutas-guardadas'] });
    },
  });
  if (!perfil) return null;
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
