// Geometría mínima del motor (pura).
import type { LatLng } from './tipos.js';

const RADIO_TIERRA_KM = 6371;
const rad = (grados: number) => (grados * Math.PI) / 180;

/** Distancia en línea recta sobre la esfera (Haversine), en km. */
export function distanciaRectaKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RADIO_TIERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
