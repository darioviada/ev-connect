// Los componentes reales usan <img> común (no el <Img> de Remotion), que el render no espera. Se precargan
// las imágenes con delayRender para que ya estén en caché cuando aparecen en pantalla.
import { continueRender, delayRender } from 'remotion';

export function precargarImagenes(urls: readonly string[]) {
  for (const url of urls) {
    const espera = delayRender(`Precarga de ${url}`);
    const img = new Image();
    img.onload = img.onerror = () => continueRender(espera);
    img.src = url;
  }
}
