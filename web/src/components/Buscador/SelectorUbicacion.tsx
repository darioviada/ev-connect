// Ubicación por GPS del navegador, por texto (geocodificación al confirmar: sin autocompletado, por la
// política de Nominatim) o por clic en el mapa (el mapa se carga recién al abrirlo).
import { lazy, Suspense, useId, useState, type FormEvent } from 'react';
import { mensajeDeError } from '../../api/cliente';
import { apiGeocodificar } from '../../api/endpoints';
import type { LatLng, Lugar } from '../../api/tipos';
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
}: {
  etiqueta: string;
  valor: UbicacionElegida | null;
  onCambio: (u: UbicacionElegida | null) => void;
}) {
  const id = useId();
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<Lugar[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapaAbierto, setMapaAbierto] = useState(false);

  async function buscar(e: FormEvent) {
    e.preventDefault();
    if (texto.trim().length < 2) return;
    setBuscando(true);
    setError(null);
    try {
      const r = await apiGeocodificar(texto.trim());
      setResultados(r.resultados);
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
          placeholder="Dirección o barrio + Enter"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          autoComplete="off"
        />
        <BotonIcono icono="buscar" etiqueta="Buscar dirección" type="submit" />
      </form>

      {buscando && <p className={s.ayuda}>Buscando…</p>}
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      {resultados && (
        <ul className={s.resultadosLugar} aria-label="Lugares encontrados">
          {resultados.length === 0 && (
            <li className={s.ayuda}>No encontramos ese lugar. Probá marcarlo en el mapa.</li>
          )}
          {resultados.map((l) => (
            <li key={`${l.lat},${l.lng}`}>
              <button
                type="button"
                onClick={() => {
                  onCambio({ lat: l.lat, lng: l.lng, nombre: l.nombre });
                  setResultados(null);
                  setTexto('');
                }}
              >
                <strong>{l.nombre}</strong>
                <span>{l.descripcion}</span>
              </button>
            </li>
          ))}
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
