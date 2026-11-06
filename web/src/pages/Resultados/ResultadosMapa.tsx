// /resultados/mapa — Vista PRINCIPAL de resultados (D-042): mapa Leaflet/OSM con pines (el mejor en verde),
// origen/destino y recorrido en modo ruta, y una hoja con el resumen y la lista. La lista sola está en
// /resultados.
import { Marker } from 'react-leaflet';
import { useNavigate, useSearchParams } from 'react-router';
import { mensajeDeError } from '../../api/cliente';
import { iconoCargador, iconoParada } from '../../components/Mapa/iconos';
import {
  AjustarVista,
  LineaRuta,
  LineaTrazado,
  MapaBase,
  PuntoMapa,
} from '../../components/Mapa/Mapa';
import {
  AvisosBusqueda,
  Descartados,
  GuardarRuta,
  ResumenBusqueda,
  SinResultados,
} from '../../components/Resultados/InfoBusqueda';
import { PlanDeViaje } from '../../components/Resultados/PlanDeViaje';
import { TarjetaRecomendacion } from '../../components/Resultados/TarjetaRecomendacion';
import s from '../../components/Resultados/Resultados.module.css';
import { Alerta, BotonIcono, Cargando, EnlaceBoton, Vacio } from '../../components/ui';
import { decodificarBusqueda } from '../../dominio/busqueda';
import { useRecomendaciones } from '../../hooks/consultas';

export default function ResultadosMapa() {
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
  const recs = r?.recomendaciones ?? [];
  const titulo =
    busqueda.modo === 'ruta'
      ? `${busqueda.origenNombre ?? 'Origen'} → ${busqueda.destinoNombre ?? 'Destino'}`
      : `Cerca de ${busqueda.origenNombre ?? 'tu ubicación'}`;
  // Paradas siguientes del plan de la mejor opción (la primera es su propio pin)
  const paradas = recs[0]?.plan?.factible ? recs[0].plan.paradas.slice(1) : [];
  const enPlan = new Set(paradas.map((p) => p.cargador.id));
  const enlace = (id: string) => `/cargadores/${id}?b=${b}`;
  const puntos = [
    busqueda.origen,
    ...(busqueda.destino && busqueda.modo === 'ruta' ? [busqueda.destino] : []),
    ...recs.map((x) => x.cargador.ubicacion),
    ...paradas.map((p) => p.cargador.ubicacion),
  ];

  return (
    <div className={s.vistaMapa}>
      <h1 className="sr-only">Cargadores recomendados: {titulo}</h1>
      <div className={s.barraFlotante}>
        <BotonIcono icono="volver" etiqueta="Volver al buscador" onClick={() => navigate('/')} />
        <span className={s.tituloRuta}>{titulo}</span>
        <BotonIcono
          icono="lista"
          etiqueta="Ver como lista"
          onClick={() => navigate(`/resultados?b=${b}`, { replace: true })}
        />
      </div>

      <MapaBase
        className={s.mapaCompleto}
        centro={busqueda.origen}
        etiqueta="Mapa de cargadores recomendados"
      >
        <AjustarVista puntos={puntos} />
        <PuntoMapa posicion={busqueda.origen} tipo="origen" />
        {busqueda.modo === 'ruta' && busqueda.destino && (
          <>
            <PuntoMapa posicion={busqueda.destino} tipo="destino" />
            {r?.trazado ? (
              <LineaTrazado puntos={r.trazado.puntos} />
            ) : (
              <LineaRuta origen={busqueda.origen} destino={busqueda.destino} />
            )}
          </>
        )}
        {paradas.map((p, i) => (
          <Marker
            key={`parada-${p.cargador.id}`}
            position={[p.cargador.ubicacion.lat, p.cargador.ubicacion.lng]}
            icon={iconoParada(i + 2)}
            title={`Parada ${i + 2}: ${p.cargador.nombre}`}
            alt={`Parada ${i + 2}: ${p.cargador.nombre}`}
            keyboard
            eventHandlers={{ click: () => navigate(enlace(p.cargador.id)) }}
          />
        ))}
        {[...recs]
          .reverse()
          .filter((rec) => !enPlan.has(rec.cargador.id))
          .map((rec) => (
            <Marker
              key={rec.cargador.id}
              position={[rec.cargador.ubicacion.lat, rec.cargador.ubicacion.lng]}
              icon={iconoCargador(rec.mejorOpcion)}
              title={rec.cargador.nombre}
              alt={rec.cargador.nombre}
              keyboard
              eventHandlers={{ click: () => navigate(enlace(rec.cargador.id)) }}
            />
          ))}
      </MapaBase>

      <section className={s.hoja} aria-label="Resultados de la búsqueda">
        <div className={s.asa} aria-hidden="true" />
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
            {busqueda.modo === 'ruta' && (
              <p className={s.leyenda}>
                {r.trazado
                  ? `Recorrido total hasta el destino: ${r.trazado.distanciaKm.toLocaleString('es-AR')} km, ~${r.trazado.duracionMin} min (Google, sin tráfico).`
                  : 'Línea recta entre origen y destino: el modo offline no calcula el recorrido por calles.'}
              </p>
            )}
            <GuardarRuta busqueda={busqueda} />
            <SinResultados r={r} />
            {recs[0] && <PlanDeViaje rec={recs[0]} busqueda={busqueda} enlace={enlace} />}
          </>
        )}
        {recs.length > 0 && (
          <>
            <h2 className={s.conteo}>
              {recs.length} cargador{recs.length === 1 ? '' : 'es'}{' '}
              {busqueda.modo === 'ruta' ? 'en tu ruta' : 'cerca'}, ordenados según tu búsqueda
            </h2>
            <ul className={s.lista} aria-label="Cargadores recomendados">
              {recs.map((rec) => (
                <li key={rec.cargador.id}>
                  <TarjetaRecomendacion
                    compacta
                    rec={rec}
                    modo={busqueda.modo}
                    enlace={`/cargadores/${rec.cargador.id}?b=${b}`}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
        {r && <Descartados r={r} />}
      </section>
    </div>
  );
}
