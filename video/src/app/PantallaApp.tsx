// Contexto para usar componentes reales de la app (../web/src) dentro del video: estilos globales y tokens
// de la app, y un router en memoria (los botones-enlace usan <Link>, pero acá no se navega).
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import '../../../web/src/styles/global.css';

export function PantallaApp({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}
