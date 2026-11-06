// Los CSS de la app tienen reglas @media (min-width: 1024px) que el navegador evalúa contra el ancho del
// VIDEO (1920 px), no del celular. Dentro de .pantalla-celular se restituyen los valores móviles, con los
// nombres reales de las clases (CSS Modules) y más especificidad que la regla de escritorio.
// Los elementos "fixed" de la app se fijan al celular (absolute dentro de la pantalla).
import marco from '../../../web/src/components/Marco/Marco.module.css';
import ui from '../../../web/src/components/ui/ui.module.css';
import resultados from '../../../web/src/components/Resultados/Resultados.module.css';
import detalle from '../../../web/src/pages/Detalle/Detalle.module.css';
import home from '../../../web/src/pages/Home/Home.module.css';
import publicar from '../../../web/src/pages/Publicar/Publicar.module.css';

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
${p(home.saludo)} { display: flex; }
${p(home.tarjeta)} { padding: 0; border-radius: 0; background: none; box-shadow: none; }
${p(home.grilla)} { display: flex; gap: var(--espacio-4); }
${p(home.accesos)} { display: none; }
${p(marco.contenidoCompleto)} { min-height: 0; overflow: hidden; }
${p(resultados.vistaMapa)} { flex-direction: column; height: 100%; }
${p(resultados.hoja)} {
  width: auto;
  flex: none;
  max-height: 330px;
  overflow: hidden;
  border-radius: var(--radio-tarjeta-grande) var(--radio-tarjeta-grande) 0 0;
}
${p(resultados.barraFlotante)} { left: var(--espacio-4); }
${p(resultados.asa)} { display: block; }
${p(detalle.columnas)} { display: flex; }
${p(publicar.grilla)} { grid-template-columns: none; }
${p(publicar.franja)} { grid-template-columns: 1fr 1fr; }
${p(publicar.franja)} > :first-child { grid-column: 1 / -1; }
`;

export function EstilosMovil() {
  return <style>{REGLAS}</style>;
}
