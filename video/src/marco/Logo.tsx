// Logo de EVConnect: el mismo de la app (rayo blanco sobre cuadrado verde), con el ícono real.
import { Icono } from '../../../web/src/components/ui/Icono';

export function Logo({ tamano = 80 }: { tamano?: number }) {
  return (
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        width: tamano,
        height: tamano,
        borderRadius: tamano * 0.275,
        background: 'var(--color-primario)',
        color: 'var(--color-superficie)',
        flex: 'none',
      }}
    >
      <Icono nombre="rayo" tamano={Math.round(tamano / 2)} />
    </div>
  );
}
