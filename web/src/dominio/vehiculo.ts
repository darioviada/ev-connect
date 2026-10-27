// Cálculos de la interfaz que replican las reglas del motor (SPEC §6.2) para mostrarlas en vivo.
// La recomendación la calcula siempre la API; esto es solo para el feedback inmediato del slider.

export type Urgencia = 'baja' | 'media' | 'alta';

export interface DatosVehiculo {
  capacidadBateriaKwh: number;
  consumoKwhPor100km: number;
}

/** >70 % baja · 30–70 % media · <30 % alta. */
export function urgenciaDe(bateriaPct: number): Urgencia {
  if (bateriaPct > 70) return 'baja';
  if (bateriaPct >= 30) return 'media';
  return 'alta';
}

/** Autonomía en km = capacidad × (batería/100) / consumo × 100. */
export function autonomiaKm(v: DatosVehiculo, bateriaPct = 100): number {
  return ((v.capacidadBateriaKwh * (bateriaPct / 100)) / v.consumoKwhPor100km) * 100;
}

export const URGENCIAS: { valor: Urgencia; nombre: string; rango: string }[] = [
  { valor: 'baja', nombre: 'Baja', rango: 'Batería > 70%' },
  { valor: 'media', nombre: 'Media', rango: 'Entre 30% y 70%' },
  { valor: 'alta', nombre: 'Alta', rango: 'Batería < 30%' },
];
