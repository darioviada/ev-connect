// Lugares del caso de uso (Córdoba): casa y trabajo de Juan. Coordenadas de ejemplo.
import type { Lugar } from '../pantallas/Home';

export const CASA: Lugar = { nombre: 'Casa', lat: -31.3982, lng: -64.2579 };
export const TRABAJO: Lugar = { nombre: 'Trabajo', lat: -31.4135, lng: -64.1811 };

/** Rutas guardadas de Juan (la app las nombra "Origen → Destino"). */
export const RUTAS_GUARDADAS = ['Casa → Trabajo', 'Casa → Villa Carlos Paz'] as const;
