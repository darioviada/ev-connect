// Mapas con Leaflet + OpenStreetMap (atribución visible, requerida por la licencia de OSM).
// Los pines son divIcons con SVG propio (sin imágenes externas).
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { iconoPunto } from './iconos';
import { useEffect, type ReactNode } from 'react';
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
  ZoomControl,
} from 'react-leaflet';
import type { LatLng } from '../../api/tipos';
import { config } from '../../config';
import s from './Mapa.module.css';

export function MapaBase({
  centro = config.centroMapa,
  zoom = 13,
  children,
  className,
  etiqueta,
}: {
  centro?: LatLng;
  zoom?: number;
  children?: ReactNode;
  className?: string;
  etiqueta: string;
}) {
  return (
    <div className={className ?? s.contenedor} role="region" aria-label={etiqueta}>
      <MapContainer
        center={[centro.lat, centro.lng]}
        zoom={zoom}
        className={s.mapa}
        scrollWheelZoom
        zoomControl={false}
      >
        {/* Abajo a la derecha: arriba quedan los botones de la vista */}
        <ZoomControl position="bottomright" />
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={19}
        />
        {children}
      </MapContainer>
    </div>
  );
}

/** Ajusta la vista para que se vean todos los puntos. */
export function AjustarVista({ puntos }: { puntos: LatLng[] }) {
  const mapa = useMap();
  const clave = JSON.stringify(puntos);
  useEffect(() => {
    if (puntos.length === 0) return;
    if (puntos.length === 1) {
      mapa.setView([puntos[0]!.lat, puntos[0]!.lng], 14);
      return;
    }
    mapa.fitBounds(L.latLngBounds(puntos.map((p) => [p.lat, p.lng] as [number, number])), {
      padding: [40, 40],
    });
    // `clave` resume los puntos: se reajusta solo si cambian
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapa, clave]);
  return null;
}

/** Captura clics en el mapa (para elegir una ubicación). */
export function AlHacerClic({ onClic }: { onClic: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onClic({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

export function PuntoMapa({ posicion, tipo }: { posicion: LatLng; tipo: 'origen' | 'destino' }) {
  return <Marker position={[posicion.lat, posicion.lng]} icon={iconoPunto(tipo)} />;
}

/** Camino real por calles (trazado de Google). */
export function LineaTrazado({ puntos }: { puntos: [number, number][] }) {
  return (
    <Polyline positions={puntos} pathOptions={{ color: '#0c7f57', weight: 5, opacity: 0.85 }} />
  );
}

/** Línea punteada origen → destino (recta: el modo offline no calcula el trazado real). */
export function LineaRuta({ origen, destino }: { origen: LatLng; destino: LatLng }) {
  return (
    <Polyline
      positions={[
        [origen.lat, origen.lng],
        [destino.lat, destino.lng],
      ]}
      pathOptions={{ color: '#0c7f57', weight: 4, dashArray: '8 10' }}
    />
  );
}
