// §6.5 — Scoring. La interfaz ScoringStrategy permite sumar otra técnica (p. ej. TOPSIS) sin tocar el resto.
// Implementación por defecto: suma ponderada (WSM) con normalización min–max; todos los criterios son
// "menor es mejor".
import { CRITERIOS, type Criterio, type DetalleCriterio, type Pesos } from './tipos.js';

export type ValoresCriterios = Record<Criterio, number>;

export interface Puntaje {
  /** 0 a 100; mayor es mejor. */
  score: number;
  desglose: Record<Criterio, DetalleCriterio>;
}

export interface ScoringStrategy {
  readonly nombre: string;
  /** Devuelve un puntaje por candidato, en el mismo orden recibido. */
  puntuar(valores: readonly ValoresCriterios[], pesos: Pesos): Puntaje[];
}

/** norm = (x − min) / (max − min); si max = min, 0 para todos. */
export function normalizarMinMax(valores: readonly number[]): number[] {
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  if (max === min) return valores.map(() => 0);
  return valores.map((x) => (x - min) / (max - min));
}

export const estrategiaWSM: ScoringStrategy = {
  nombre: 'WSM (suma ponderada con normalización min–max)',

  puntuar(valores, pesos) {
    const normalizados = Object.fromEntries(
      CRITERIOS.map((c) => [c, normalizarMinMax(valores.map((v) => v[c]))]),
    ) as Record<Criterio, number[]>;

    return valores.map((v, i) => {
      const desglose = Object.fromEntries(
        CRITERIOS.map((c) => {
          const normalizado = normalizados[c][i]!;
          const detalle: DetalleCriterio = {
            valor: v[c],
            normalizado,
            peso: pesos[c],
            aporte: 100 * pesos[c] * (1 - normalizado),
          };
          return [c, detalle];
        }),
      ) as Record<Criterio, DetalleCriterio>;
      // score = 100 × (1 − Σ wᵢ·normᵢ) = Σ aportes (los pesos suman 1)
      const score = 100 * (1 - CRITERIOS.reduce((s, c) => s + pesos[c] * normalizados[c][i]!, 0));
      return { score, desglose };
    });
  },
};
