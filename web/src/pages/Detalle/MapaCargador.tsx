// Mapa chico con la ubicación del cargador (carga diferida).
import { Marker } from 'react-leaflet';
import type { LatLng } from '../../api/tipos';
import { iconoCargador } from '../../components/Mapa/iconos';
import { MapaBase } from '../../components/Mapa/Mapa';

export default function MapaCargador({ posicion }: { posicion: LatLng }) {
  return (
    <MapaBase centro={posicion} zoom={15} etiqueta="Ubicación del cargador">
      <Marker position={[posicion.lat, posicion.lng]} icon={iconoCargador(true)} />
    </MapaBase>
  );
}
