// Estructura de la app con sesión iniciada (web/src/components/Marco) en versión móvil: barra superior con
// el logo y el avatar, contenido y navegación inferior. Mismo CSS Module; sin lógica de sesión.
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
  children,
}: {
  seccion: Seccion;
  /** Scroll simulado del contenido, en px. */
  desplazamiento?: number;
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
        <div className={marco.usuario}>
          <span className={marco.avatar} aria-hidden="true">
            {JUAN.nombre.charAt(0)}
          </span>
          <span className={marco.salir}>
            <Icono nombre="salir" />
          </span>
        </div>
      </header>

      <main className={marco.contenido} style={{ position: 'relative' }}>
        <div style={{ transform: `translateY(${-desplazamiento}px)` }}>{children}</div>
      </main>

      <nav className={marco.navInferior} aria-label="Principal">
        {SECCIONES.map((s) => (
          <a key={s.id} className={s.id === seccion ? marco.activo : undefined}>
            <Icono nombre={s.icono} />
            <span>{s.nombre}</span>
          </a>
        ))}
      </nav>

      <p className={marco.avisoDemo} role="note">
        Datos de demostración (sintéticos)
      </p>
    </div>
  );
}
