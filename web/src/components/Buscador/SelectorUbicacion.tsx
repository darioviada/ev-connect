// Ubicación por GPS del navegador, por texto (geocodificación al confirmar: sin autocompletado, por la
// política de Nominatim) o por clic en el mapa (el mapa se carga recién al abrirlo).
// Con Nominatim se buscan direcciones exactas ("Colón 1234"); con la lista fija, solo barrios y ciudades.
import { lazy, Suspense, useId, useState, type FormEvent } from 'react';
import { mensajeDeError } from '../../api/cliente';
import { apiGeocodificar } from '../../api/endpoints';
import type { LatLng, Lugar } from '../../api/tipos';
import { config } from '../../config';
import { useConfiguracion } from '../../hooks/consultas';
import { Boton, BotonIcono, Cargando, claseControl, Icono } from '../ui';
import s from './Buscador.module.css';

const MapaSelector = lazy(() => import('./MapaSelector'));

export interface UbicacionElegida extends LatLng {
  nombre: string;
}

export function SelectorUbicacion({
  etiqueta,
  valor,
  onCambio,
  cerca,
}: {
  etiqueta: string;
  valor: UbicacionElegida | null;
  onCambio: (u: UbicacionElegida | null) => void;
  /** Punto de referencia para priorizar resultados cercanos (p. ej. el origen al buscar el destino). */
  cerca?: LatLng | null;
}) {
  const id = useId();
  const configuracion = useConfiguracion();
  const conDirecciones = configuracion.data?.geocodificacion === 'nominatim';
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<Lugar[] | null>(null);
  const [proveedor, setProveedor] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapaAbierto, setMapaAbierto] = useState(false);

  async function buscar(e: FormEvent) {
    e.preventDefault();
    if (texto.trim().length < 2) return;
    setBuscando(true);
    setError(null);
    try {
      // Se priorizan resultados cerca del punto ya elegido, del de referencia o del centro del mapa.
      const r = await apiGeocodificar(texto.trim(), valor ?? cerca ?? config.centroMapa);
      setResultados(r.resultados);
      setProveedor(r.proveedor);
      setAviso(r.aviso ?? null);
    } catch (err) {
      setError(mensajeDeError(err));
      setResultados(null);
    } finally {
      setBuscando(false);
    }
  }

  function usarGps() {
    setError(null);
    if (!('geolocation' in navigator)) {
      setError('Tu navegador no permite obtener la ubicación. Buscala por texto o en el mapa.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => onCambio({ lat: p.coords.latitude, lng: p.coords.longitude, nombre: 'Mi ubicación' }),
      () => setError('No se pudo obtener tu ubicación. Buscala por texto o marcala en el mapa.'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  const sinResultados =
    proveedor === 'nominatim'
      ? 'No encontramos esa dirección. Probá agregando la ciudad (por ejemplo, “Colón 1234, Córdoba”) o marcala en el mapa.'
      : 'Esta búsqueda reconoce barrios y ciudades. Para una dirección exacta, marcá el punto en el mapa.';

  return (
    <div className={s.bloque}>
      <label htmlFor={id} className={s.etiqueta}>
        {etiqueta}
      </label>
      {/* Formulario propio: Enter busca la dirección sin enviar la búsqueda de cargadores */}
      <form
        className={s.filaUbicacion}
        onSubmit={buscar}
        role="search"
        aria-label={`Buscar ${etiqueta.toLowerCase()}`}
      >
        <BotonIcono icono="gps" etiqueta="Usar mi ubicación actual" onClick={usarGps} />
        <input
          id={id}
          className={claseControl}
          placeholder={conDirecciones ? 'Calle y número, barrio o ciudad' : 'Barrio o ciudad'}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          autoComplete="off"
          aria-describedby={`${id}-ayuda`}
        />
        <BotonIcono icono="buscar" etiqueta="Buscar" type="submit" />
      </form>
      <p id={`${id}-ayuda`} className={s.ayuda}>
        {conDirecciones
          ? 'Escribí la dirección y apretá Enter.'
          : 'Escribí un barrio o una ciudad y apretá Enter, o marcá el punto en el mapa.'}
      </p>

      {buscando && <p className={s.ayuda}>Buscando…</p>}
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      {aviso && (
        <p className={s.error} role="status">
          {aviso}
        </p>
      )}
      {resultados && (
        <ul className={s.resultadosLugar} aria-label="Lugares encontrados">
          {resultados.length === 0 && <li className={s.ayuda}>{sinResultados}</li>}
          {resultados.map((l) => (
            <li key={`${l.lat},${l.lng}`}>
              <button
                type="button"
                onClick={() => {
                  onCambio({ lat: l.lat, lng: l.lng, nombre: l.nombre });
                  setResultados(null);
                  setAviso(null);
                  setTexto('');
                }}
              >
                <strong>{l.nombre}</strong>
                <span>{l.descripcion}</span>
              </button>
            </li>
          ))}
          {proveedor === 'nominatim' && resultados.length > 0 && (
            <li className={s.atribucion}>Direcciones: © colaboradores de OpenStreetMap</li>
          )}
        </ul>
      )}

      {valor && (
        <p className={s.elegido}>
          <Icono nombre="pin" tamano={18} />
          <span>
            {valor.nombre}{' '}
            <small>
              ({valor.lat.toFixed(4)}, {valor.lng.toFixed(4)})
            </small>
          </span>
          <button
            type="button"
            className={s.quitar}
            onClick={() => onCambio(null)}
            aria-label={`Quitar ${etiqueta.toLowerCase()}`}
          >
            <Icono nombre="x" tamano={16} />
          </button>
        </p>
      )}

      <Boton
        variante="texto"
        icono="mapa"
        chico
        onClick={() => setMapaAbierto((a) => !a)}
        aria-expanded={mapaAbierto}
      >
        {mapaAbierto ? 'Ocultar mapa' : 'Elegir en el mapa'}
      </Boton>
      {mapaAbierto && (
        <Suspense fallback={<Cargando texto="Cargando mapa…" />}>
          <MapaSelector
            valor={valor}
            onElegir={(p) => onCambio({ ...p, nombre: 'Punto elegido en el mapa' })}
          />
        </Suspense>
      )}
    </div>
  );
}
