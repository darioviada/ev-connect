// Los CSS de la app tienen reglas @media (min-width: 1024px) que el navegador evalúa contra el ancho del
// VIDEO (1920 px), no del celular. Dentro de .pantalla-celular se restituyen los valores móviles, con los
// nombres reales de las clases (CSS Modules) y más especificidad que la regla de escritorio.
// Los elementos "fixed" de la app se fijan al celular (absolute dentro de la pantalla).
import marco from '../../../web/src/components/Marco/Marco.module.css';
import ui from '../../../web/src/components/ui/ui.module.css';

export const CLASE_CELULAR = 'pantalla-celular';

const p = (clase: string | undefined) => `.${CLASE_CELULAR} .${clase}`;

const REGLAS = `
${p(ui.cabeceraTitulo)} { font-size: 1.4rem; }
${p(marco.marco)} { min-height: 100%; height: 100%; }
${p(marco.barra)} { padding: var(--espacio-3) var(--espacio-4); }
${p(marco.navEscritorio)}, ${p(marco.saludo)} { display: none; }
${p(marco.navInferior)} { display: grid; position: absolute; }
${p(marco.contenido)} {
  overflow: hidden;
  padding: var(--espacio-5) var(--espacio-4) calc(var(--alto-nav-inferior) + var(--espacio-7));
}
${p(marco.avisoDemo)} { position: absolute; bottom: calc(var(--alto-nav-inferior) + var(--espacio-2)); }
`;

export function EstilosMovil() {
  return <style>{REGLAS}</style>;
}
