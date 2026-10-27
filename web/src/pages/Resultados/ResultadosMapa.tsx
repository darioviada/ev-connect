// /resultados/mapa — Resultados en el mapa (Leaflet/OSM): pines (el mejor en verde), origen/destino,
// línea punteada en modo ruta (recta: el modo offline no calcula el trazado) y hoja inferior con la lista.
import { Marker } from 'react-leaflet';
import { useNavigate, useSearchParams } from 'react-router';
import { mensajeDeError } from '../../api/cliente';
import { iconoCargador } from '../../components/Mapa/iconos';
import {
  AjustarVista,
  LineaRuta,
  LineaTrazado,
  MapaBase,
  PuntoMapa,
} from '../../components/Mapa/Mapa';
import { TarjetaRecomendacion } from '../../components/Resultados/TarjetaRecomendacion';
import s from '../../components/Resultados/Resultados.module.css';
import { Alerta, BotonIcono, Cargando, Vacio } from '../../components/ui';
import { decodificarBusqueda } from '../../dominio/busqueda';
import { useRecomendaciones } from '../../hooks/consultas';

export default function ResultadosMapa() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const b = params.get('b');
  const busqueda = decodificarBusqueda(b);
  const consulta = useRecomendaciones(busqueda);

  if (!busqueda) return <Vacio titulo="No hay una búsqueda para mostrar" />;
  const r = consulta.data;
  const recs = r?.recomendaciones ?? [];
  const titulo =
    busqueda.modo === 'ruta'
      ? `${busqueda.origenNombre ?? 'Origen'} → ${busqueda.destinoNombre ?? 'Destino'}`
      : `Cerca de ${busqueda.origenNombre ?? 'tu ubicación'}`;
  const puntos = [
    busqueda.origen,
    ...(busqueda.destino && busqueda.modo === 'ruta' ? [busqueda.destino] : []),
    ...recs.map((x) => x.cargador.ubicacion),
  ];

  return (
    <div className={s.vistaMapa}>
      <div className={s.barraFlotante}>
        <BotonIcono icono="volver" etiqueta="Volver" onClick={() => navigate('/')} />
        <span className={s.tituloRuta}>{titulo}</span>
        <BotonIcono
          icono="lista"
          etiqueta="Ver como lista"
          onClick={() => navigate(`/resultados?b=${b}`)}
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
        {[...recs].reverse().map((rec) => (
          <Marker
            key={rec.cargador.id}
            position={[rec.cargador.ubicacion.lat, rec.cargador.ubicacion.lng]}
            icon={iconoCargador(rec.mejorOpcion)}
            title={rec.cargador.nombre}
            alt={rec.cargador.nombre}
            keyboard
            eventHandlers={{ click: () => navigate(`/cargadores/${rec.cargador.id}?b=${b}`) }}
          />
        ))}
      </MapaBase>

      <section className={s.hoja} aria-label="Lista de cargadores">
        <div className={s.asa} aria-hidden="true" />
        {consulta.isPending && <Cargando />}
        {consulta.isError && (
          <Alerta>
            <p>{mensajeDeError(consulta.error)}</p>
          </Alerta>
        )}
        {r?.sinResultados && <p>{r.sinResultados.mensaje}</p>}
        {busqueda.modo === 'ruta' && r && (
          <p className={s.leyenda}>
            {r.trazado
              ? `Recorrido por calles: ${r.trazado.distanciaKm.toLocaleString('es-AR')} km, ~${r.trazado.duracionMin} min (Google, sin tráfico).`
              : 'Línea recta entre origen y destino: el modo offline no calcula el recorrido por calles.'}
          </p>
        )}
        {recs.length > 0 && (
          <>
            <h2 className={s.conteo}>
              {recs.length} cargador{recs.length === 1 ? '' : 'es'}{' '}
              {busqueda.modo === 'ruta' ? 'en tu ruta' : 'cerca'}
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
      </section>
    </div>
  );
}
