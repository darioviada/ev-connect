// Rutas que requieren sesión: redirigen a /login y vuelven al destino después de ingresar.
// (La autorización real la hace siempre la API; esto es solo navegación.)
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { Cargando, Vacio } from '../components/ui';
import { useSesion } from './Sesion';

export function RutaProtegida({
  children,
  soloAdmin,
}: {
  children: ReactNode;
  soloAdmin?: boolean;
}) {
  const { perfil, cargando } = useSesion();
  const ubicacion = useLocation();

  if (cargando) return <Cargando />;
  if (!perfil) {
    const volver = encodeURIComponent(ubicacion.pathname + ubicacion.search);
    return <Navigate to={`/login?volver=${volver}`} replace />;
  }
  if (soloAdmin && perfil.rol !== 'admin') {
    return <Vacio titulo="No tenés permiso para ver esta sección" icono="escudo" />;
  }
  return <>{children}</>;
}
