// Estructura de la app con sesión iniciada (web/src/components/Marco): barra superior con el logo, la
// navegación de escritorio y el usuario; contenido; navegación inferior (móvil). Mismo CSS Module y mismas
// reglas: dentro del celular se ve la versión móvil y en la ventana de escritorio, la de escritorio.
import type { ReactNode } from 'react';
import { Icono, type NombreIcono } from '../../../web/src/components/ui/Icono';
import marco from '../../../web/src/components/Marco/Marco.module.css';
import { JUAN } from '../datos/vehiculos';

export type Seccion = 'home' | 'vehiculos' | 'publicar' | 'reservas' | 'favoritos';

const SECCIONES: { id: Seccion; nombre: string; icono: NombreIcono }[] = [
  { id: 'home', nombre: 'Home', icono: 'casa' },
  { id: 'vehiculos', nombre: 'Vehículos', icono: 'auto' },
  { id: 'publicar', nombre: 'Publicar', icono: 'rayo' },
  { id: 'reservas', nombre: 'Reservas', icono: 'calendario' },
  { id: 'favoritos', nombre: 'Favoritos', icono: 'corazon' },
];

export function MarcoApp({
  seccion,
  desplazamiento = 0,
  sinNavegacion = false,
  children,
}: {
  seccion: Seccion;
  /** Scroll simulado del contenido, en px. */
  desplazamiento?: number;
  /** Vista de mapa: sin navegación inferior y contenido a pantalla completa (como en la app). */
  sinNavegacion?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={marco.marco}>
      <header className={marco.barra}>
        <span className={marco.logo}>
          <span className={marco.logoIcono} aria-hidden="true">
            <Icono nombre="rayo" tamano={18} />
          </span>
          EVConnect
        </span>
        <nav className={marco.navEscritorio} aria-label="Principal">
          {SECCIONES.slice(1).map((s) => (
            <a key={s.id} className={s.id === seccion ? marco.activo : undefined}>
              {s.nombre}
            </a>
          ))}
        </nav>
        <div className={marco.usuario}>
          <span className={marco.saludo}>Hola, {JUAN.nombre.split(' ')[0]}</span>
          <span className={marco.avatar} aria-hidden="true">
            {JUAN.nombre.charAt(0)}
          </span>
          <span className={marco.salir}>
            <Icono nombre="salir" />
          </span>
        </div>
      </header>

      <main
        className={sinNavegacion ? marco.contenidoCompleto : marco.contenido}
        style={{ position: 'relative' }}
      >
        {sinNavegacion ? (
          children
        ) : (
          <div style={{ transform: `translateY(${-desplazamiento}px)` }}>{children}</div>
        )}
      </main>

      {!sinNavegacion && (
        <nav className={marco.navInferior} aria-label="Principal">
          {SECCIONES.map((s) => (
            <a key={s.id} className={s.id === seccion ? marco.activo : undefined}>
              <Icono nombre={s.icono} />
              <span>{s.nombre}</span>
            </a>
          ))}
        </nav>
      )}

      <p className={marco.avisoDemo} role="note">
        Datos de demostración (sintéticos)
      </p>
    </div>
  );
}
