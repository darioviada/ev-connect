// Parámetros del motor en un único lugar (SPEC §6). Cambiar los pesos acá cambia el comportamiento de
// toda la aplicación y de `npm run validate`.
import type { Criterio, Pesos, Urgencia } from './tipos.js';

export interface ConfigMotor {
  /** Pesos por urgencia. Cada fila suma 1. */
  pesos: Record<Urgencia, Pesos>;
  /**
   * Rango mínimo de normalización por criterio (desvío del SPEC, ver docs/DECISIONES.md D-026).
   * Diferencias menores que este umbral pesan proporcionalmente poco: 100 m de distancia no deben
   * decidir frente a horas de carga. Unidades: km, min, min y ARS.
   */
  rangosMinimos: Record<Criterio, number>;
  /** Se exige autonomía × margen ≥ distancia (margen de seguridad del 10 %). */
  margenSeguridad: number;
  /** Estado de carga mínimo al llegar al cargador (%). */
  socMinimoLlegadaPct: number;
  /** Fracción de la potencia nominal que se aprovecha en promedio. */
  eficienciaCarga: number;
  /** Se carga hasta max(objetivoMinimoPct, llegada + objetivoExtraPct), con tope 100 %. */
  objetivoMinimoPct: number;
  objetivoExtraPct: number;
  /** Espera máxima aceptable (horario + reservas). Más que esto, se descarta. */
  esperaMaximaMin: number;
  /** Por debajo de este SoC de llegada se agrega una advertencia. */
  socBajoAdvertenciaPct: number;
  /** Zona horaria de negocio de franjas y reservas. */
  zonaHoraria: string;
  /** Plan de viaje (D-045): puntos de SoC que se cargan por encima de lo justo para el tramo siguiente. */
  margenCargaViajePct: number;
  /** Una parada siguiente tiene que acercar al destino al menos esto (km). */
  avanceMinimoKm: number;
  /** Costo fijo de cada parada extra al comparar planes (min); no se suma a los tiempos informados. */
  penalidadParadaMin: number;
  /**
   * Modo ruta (D-046): un cargador desde el que el destino queda más de esto (km) más lejos que desde el
   * origen está en sentido contrario al viaje.
   */
  toleranciaSentidoContrarioKm: number;
}

export const CONFIG_MOTOR: ConfigMotor = {
  pesos: {
    alta: { distancia: 0.45, espera: 0.25, carga: 0.2, costo: 0.1 },
    media: { distancia: 0.3, espera: 0.2, carga: 0.25, costo: 0.25 },
    baja: { distancia: 0.15, espera: 0.15, carga: 0.2, costo: 0.5 },
  },
  rangosMinimos: { distancia: 3, espera: 15, carga: 30, costo: 2000 },
  margenSeguridad: 0.9,
  socMinimoLlegadaPct: 5,
  eficienciaCarga: 0.9,
  objetivoMinimoPct: 80,
  objetivoExtraPct: 10,
  esperaMaximaMin: 120,
  socBajoAdvertenciaPct: 15,
  zonaHoraria: 'America/Argentina/Cordoba',
  margenCargaViajePct: 10,
  avanceMinimoKm: 5,
  penalidadParadaMin: 10,
  toleranciaSentidoContrarioKm: 0.5,
};
