// Rutas de la aplicación (docs/SPEC.md §10.2).
import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router';
import { RutaProtegida } from './auth/RutaProtegida';
import { eligioInvitado, useSesion } from './auth/Sesion';
import { Marco } from './components/Marco/Marco';
import { Cargando, EnlaceBoton, Vacio } from './components/ui';
import { Admin } from './pages/Admin/Admin';
import { DetalleCargador } from './pages/Detalle/DetalleCargador';
import { Favoritos } from './pages/Favoritos/Favoritos';
import { Home } from './pages/Home/Home';
import { Inicio } from './pages/Inicio/Inicio';
import { Login } from './pages/Login/Login';
import { MisCargadores } from './pages/Publicar/MisCargadores';
import { Publicar } from './pages/Publicar/Publicar';
import { Reservas } from './pages/Reservas/Reservas';
import { Resultados } from './pages/Resultados/Resultados';
import { VehiculoDetalle, VehiculoFormulario, Vehiculos } from './pages/Vehiculos/Vehiculos';

// El mapa de resultados carga Leaflet: se descarga solo al abrirlo.
const ResultadosMapa = lazy(() => import('./pages/Resultados/ResultadosMapa'));

/** La primera visita sin sesión muestra la bienvenida (/inicio). */
function PrimeraVisita({ children }: { children: ReactNode }) {
  const { perfil, cargando } = useSesion();
  if (cargando) return <Cargando />;
  if (!perfil && !eligioInvitado()) return <Navigate to="/inicio" replace />;
  return <>{children}</>;
}

const protegida = (elemento: ReactNode, soloAdmin = false) => (
  <RutaProtegida soloAdmin={soloAdmin}>{elemento}</RutaProtegida>
);

function ConMarco() {
  return (
    <Marco>
      <Outlet />
    </Marco>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/inicio" element={<Inicio />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/resultados/mapa"
        element={
          <Marco sinNavegacion>
            <Suspense fallback={<Cargando texto="Cargando mapa…" />}>
              <ResultadosMapa />
            </Suspense>
          </Marco>
        }
      />
      <Route element={<ConMarco />}>
        <Route
          index
          element={
            <PrimeraVisita>
              <Home />
            </PrimeraVisita>
          }
        />
        <Route path="resultados" element={<Resultados />} />
        <Route path="cargadores/:id" element={<DetalleCargador />} />
        <Route path="vehiculos" element={protegida(<Vehiculos />)} />
        <Route path="vehiculos/nuevo" element={protegida(<VehiculoFormulario />)} />
        <Route path="vehiculos/:id" element={protegida(<VehiculoDetalle />)} />
        <Route path="vehiculos/:id/editar" element={protegida(<VehiculoFormulario />)} />
        <Route path="reservas" element={protegida(<Reservas />)} />
        <Route path="publicar" element={protegida(<Publicar />)} />
        <Route path="mis-cargadores" element={protegida(<MisCargadores />)} />
        <Route path="mis-cargadores/:id/editar" element={protegida(<Publicar />)} />
        <Route path="favoritos" element={protegida(<Favoritos />)} />
        <Route path="admin" element={protegida(<Admin />, true)} />
        <Route
          path="*"
          element={
            <Vacio titulo="Esta página no existe">
              <EnlaceBoton a="/">Ir al inicio</EnlaceBoton>
            </Vacio>
          }
        />
      </Route>
    </Routes>
  );
}
