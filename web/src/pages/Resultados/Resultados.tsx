// /resultados — Cargadores recomendados en lista (HU-008 y HU-009). La vista principal después de
// buscar es el mapa (/resultados/mapa, D-042); esta es la alternativa en lista.
import { useNavigate, useSearchParams } from 'react-router';
import { mensajeDeError } from '../../api/cliente';
import {
  AvisosBusqueda,
  Descartados,
  GuardarRuta,
  ResumenBusqueda,
  SinResultados,
} from '../../components/Resultados/InfoBusqueda';
import { TarjetaRecomendacion } from '../../components/Resultados/TarjetaRecomendacion';
import s from '../../components/Resultados/Resultados.module.css';
import { Alerta, BotonIcono, Cabecera, Cargando, EnlaceBoton, Vacio } from '../../components/ui';
import { decodificarBusqueda } from '../../dominio/busqueda';
import { useRecomendaciones } from '../../hooks/consultas';

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
        subtitulo={
          busqueda.modo === 'ruta'
            ? `${busqueda.origenNombre ?? 'Origen'} → ${busqueda.destinoNombre ?? 'Destino'}`
            : 'Ordenados según tu búsqueda'
        }
        volver="/"
        accion={
          <BotonIcono
            icono="mapa"
            etiqueta="Ver en el mapa"
            suave
            onClick={() => navigate(`/resultados/mapa?b=${b}`, { replace: true })}
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
          <ResumenBusqueda r={r} busqueda={busqueda} />
          <AvisosBusqueda r={r} />
          <GuardarRuta busqueda={busqueda} />
          <SinResultados r={r} />
          {!r.sinResultados && (
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
          <Descartados r={r} />
        </>
      )}
    </>
  );
}
