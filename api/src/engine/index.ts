// Motor de recomendación (puro). Ver docs/SPEC.md §6.
export { CONFIG_MOTOR, type ConfigMotor } from './config.js';
export { evaluarDisponibilidad, proximoInicioEnHorario } from './disponibilidad.js';
export { recomendar, type EntradaMotor } from './recomendar.js';
export {
  alcanceMaximoKm,
  autonomiaKm,
  objetivoParaTramoPct,
  esAlcanzable,
  esCompatible,
  estimarCarga,
  potenciaEfectivaKw,
  socLlegadaPct,
  urgenciaDe,
} from './reglas.js';
export {
  estrategiaWSM,
  normalizarMinMax,
  type Puntaje,
  type ScoringStrategy,
  type ValoresCriterios,
} from './scoring.js';
export * from './tipos.js';
export { distanciaRectaKm } from './geo.js';
export { planificarViaje, type ContextoViaje, type InicioPlan } from './viaje.js';
