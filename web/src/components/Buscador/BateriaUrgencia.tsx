// Slider de batería: recalcula en vivo la urgencia (resalta Baja/Media/Alta) y la autonomía actual.
import { useId } from 'react';
import { autonomiaKm, URGENCIAS, urgenciaDe, type DatosVehiculo } from '../../dominio/vehiculo';
import s from './Buscador.module.css';

export function BateriaUrgencia({
  bateriaPct,
  onCambio,
  vehiculo,
}: {
  bateriaPct: number;
  onCambio: (pct: number) => void;
  vehiculo: DatosVehiculo | null;
}) {
  const id = useId();
  const urgencia = urgenciaDe(bateriaPct);
  return (
    <div className={s.bloque}>
      <div className={s.filaBateria}>
        <label htmlFor={id} className={s.etiqueta}>
          Batería actual
        </label>
        <output htmlFor={id} className={s.porcentaje}>
          {bateriaPct}%
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={1}
        value={bateriaPct}
        onChange={(e) => onCambio(Number(e.target.value))}
        className={s.slider}
        aria-valuetext={`${bateriaPct} por ciento, urgencia ${urgencia}`}
      />
      <p className={s.autonomia} aria-live="polite">
        {vehiculo
          ? `Autonomía actual: ~${Math.round(autonomiaKm(vehiculo, bateriaPct))} km`
          : 'Elegí un vehículo para ver la autonomía actual'}
      </p>

      <span className={s.etiqueta} id={`${id}-urgencia`}>
        Urgencia
      </span>
      <ul className={s.urgencias} aria-labelledby={`${id}-urgencia`}>
        {URGENCIAS.map((u) => (
          <li
            key={u.valor}
            className={u.valor === urgencia ? s.urgenciaActiva : s.urgencia}
            aria-current={u.valor === urgencia ? 'true' : undefined}
          >
            <strong>{u.nombre}</strong>
            <span>{u.rango}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
