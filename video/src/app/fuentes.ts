// Tipografías de la app (Sora para títulos y Plus Jakarta Sans para el cuerpo), cargadas desde public/
// con @remotion/fonts: el render espera a que estén listas (https://www.remotion.dev/docs/fonts).
// Archivos copiados de @fontsource (licencia OFL-1.1).
import { loadFont } from '@remotion/fonts';
import { staticFile } from 'remotion';

const FUENTES = [
  { family: 'Sora', archivo: 'sora-latin-600-normal.woff2', weight: '600' },
  { family: 'Sora', archivo: 'sora-latin-700-normal.woff2', weight: '700' },
  {
    family: 'Plus Jakarta Sans',
    archivo: 'plus-jakarta-sans-latin-400-normal.woff2',
    weight: '400',
  },
  {
    family: 'Plus Jakarta Sans',
    archivo: 'plus-jakarta-sans-latin-500-normal.woff2',
    weight: '500',
  },
  {
    family: 'Plus Jakarta Sans',
    archivo: 'plus-jakarta-sans-latin-600-normal.woff2',
    weight: '600',
  },
] as const;

export function cargarFuentes() {
  for (const f of FUENTES) {
    void loadFont({ family: f.family, url: staticFile(`fuentes/${f.archivo}`), weight: f.weight });
  }
}
