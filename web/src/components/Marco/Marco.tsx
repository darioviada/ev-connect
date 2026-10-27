// Estructura común: barra superior (escritorio, desde 1024 px), navegación inferior (móvil) y avisos.
import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import { useSesion } from '../../auth/Sesion';
import { Icono, type NombreIcono } from '../ui';
import s from './Marco.module.css';

const SECCIONES: { a: string; nombre: string; icono: NombreIcono; fin?: boolean }[] = [
  { a: '/', nombre: 'Home', icono: 'casa', fin: true },
  { a: '/vehiculos', nombre: 'Vehículos', icono: 'auto' },
  { a: '/publicar', nombre: 'Publicar', icono: 'rayo' },
  { a: '/reservas', nombre: 'Reservas', icono: 'calendario' },
  { a: '/favoritos', nombre: 'Favoritos', icono: 'corazon' },
];

export function Marco({
  children,
  sinNavegacion,
}: {
  children: ReactNode;
  sinNavegacion?: boolean;
}) {
  const { perfil, modo, cerrarSesion } = useSesion();
  const navigate = useNavigate();

  return (
    <div className={s.marco}>
      <a href="#contenido" className={s.saltar}>
        Saltar al contenido
      </a>
      <header className={s.barra}>
        <Link to="/" className={s.logo}>
          <span className={s.logoIcono} aria-hidden="true">
            <Icono nombre="rayo" tamano={18} />
          </span>
          EVConnect
        </Link>
        <nav className={s.navEscritorio} aria-label="Principal">
          {SECCIONES.slice(1).map((sec) => (
            <NavLink
              key={sec.a}
              to={sec.a}
              className={({ isActive }) => (isActive ? s.activo : undefined)}
            >
              {sec.nombre}
            </NavLink>
          ))}
          {perfil?.rol === 'admin' && (
            <NavLink to="/admin" className={({ isActive }) => (isActive ? s.activo : undefined)}>
              Admin
            </NavLink>
          )}
        </nav>
        <div className={s.usuario}>
          {perfil ? (
            <>
              <span className={s.saludo}>Hola, {perfil.nombre.split(' ')[0]}</span>
              <span className={s.avatar} aria-hidden="true">
                {perfil.nombre.charAt(0).toUpperCase()}
              </span>
              <button
                type="button"
                className={s.salir}
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
                onClick={async () => {
                  await cerrarSesion();
                  navigate('/inicio');
                }}
              >
                <Icono nombre="salir" />
              </button>
            </>
          ) : (
            <Link to="/login" className={s.ingresar}>
              Iniciar sesión
            </Link>
          )}
        </div>
      </header>

      {modo === 'local' && (
        <p className={s.modoLocal} role="note">
          Modo demo local — no usar en producción
        </p>
      )}

      <main id="contenido" className={sinNavegacion ? s.contenidoCompleto : s.contenido}>
        {children}
      </main>

      {!sinNavegacion && (
        <nav className={s.navInferior} aria-label="Principal">
          {SECCIONES.map((sec) => (
            <NavLink
              key={sec.a}
              to={sec.a}
              end={sec.fin}
              className={({ isActive }) => (isActive ? s.activo : undefined)}
            >
              <Icono nombre={sec.icono} />
              <span>{sec.nombre}</span>
            </NavLink>
          ))}
        </nav>
      )}

      <p className={s.avisoDemo} role="note">
        Datos de demostración (sintéticos)
      </p>
    </div>
  );
}
