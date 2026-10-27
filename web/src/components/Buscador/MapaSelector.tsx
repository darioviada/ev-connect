// Mapa para elegir un punto con un clic (se carga de forma diferida).
import type { LatLng } from '../../api/tipos';
import { AlHacerClic, MapaBase, PuntoMapa } from '../Mapa/Mapa';

export default function MapaSelector({
  valor,
  onElegir,
}: {
  valor: LatLng | null;
  onElegir: (p: LatLng) => void;
}) {
  return (
    <>
      <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-texto-secundario)' }}>
        Hacé clic en el mapa para marcar el punto.
      </p>
      <MapaBase centro={valor ?? undefined} etiqueta="Mapa para elegir una ubicación">
        <AlHacerClic onClic={onElegir} />
        {valor && <PuntoMapa posicion={valor} tipo="destino" />}
      </MapaBase>
    </>
  );
}
