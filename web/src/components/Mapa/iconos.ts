// Íconos de los pines (divIcons con SVG propio, sin imágenes externas).
import L from 'leaflet';
import s from './Mapa.module.css';

const RAYO =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></svg>';

export const iconoCargador = (destacado: boolean) =>
  L.divIcon({
    className: '',
    html: `<span class="${s.pin} ${destacado ? s.pinDestacado : ''}">${RAYO}</span>`,
    iconSize: destacado ? [44, 44] : [34, 34],
    iconAnchor: destacado ? [22, 22] : [17, 17],
  });

export const iconoPunto = (tipo: 'origen' | 'destino') =>
  L.divIcon({
    className: '',
    html: `<span class="${tipo === 'origen' ? s.origen : s.destino}"></span>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
