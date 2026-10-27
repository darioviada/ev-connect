// Decodificador del formato "Encoded Polyline" de Google (precisión 5), el que devuelve computeRoutes
// en routes.polyline.encodedPolyline. Algoritmo público documentado por Google Maps Platform.
import type { LatLng } from './tipos.js';

export function decodificarPolyline(codificado: string, precision = 5): LatLng[] {
  const factor = 10 ** precision;
  const puntos: LatLng[] = [];
  let indice = 0;
  let lat = 0;
  let lng = 0;

  const siguienteValor = () => {
    let resultado = 0;
    let desplazamiento = 0;
    let byte: number;
    do {
      if (indice >= codificado.length)
        throw new Error('Polyline inválida: termina antes de tiempo');
      byte = codificado.charCodeAt(indice++) - 63;
      resultado |= (byte & 0x1f) << desplazamiento;
      desplazamiento += 5;
    } while (byte >= 0x20);
    return resultado & 1 ? ~(resultado >> 1) : resultado >> 1;
  };

  while (indice < codificado.length) {
    lat += siguienteValor();
    lng += siguienteValor();
    puntos.push({ lat: lat / factor, lng: lng / factor });
  }
  return puntos;
}
