// Reglas del motor (SPEC §6.2–§6.4) y scoring (§6.5).
import { describe, expect, it } from 'vitest';
import {
  alcanceMaximoKm,
  autonomiaKm,
  CONFIG_MOTOR,
  esAlcanzable,
  esCompatible,
  estimarCarga,
  estrategiaWSM,
  normalizarMinMax,
  potenciaEfectivaKw,
  socLlegadaPct,
  urgenciaDe,
} from '../../src/engine/index.js';
import {
  aFechaHora,
  aMinutosLocales,
  diaDeLaSemana,
  minutosLocales,
} from '../../src/engine/tiempo.js';
import { AHORA, VEHICULO_CCS, VEHICULO_CHADEMO, VEHICULO_T2 } from './fixtures.js';

describe('urgencia (bordes 29, 30, 70, 71)', () => {
  it.each([
    [0, 'alta'],
    [29, 'alta'],
    [29.9, 'alta'],
    [30, 'media'],
    [70, 'media'],
    [70.1, 'baja'],
    [71, 'baja'],
    [100, 'baja'],
  ])('%s %% → %s', (pct, esperado) => {
    expect(urgenciaDe(pct)).toBe(esperado);
  });
});

describe('autonomía actual', () => {
  it('capacidad × batería / consumo × 100', () => {
    expect(autonomiaKm(VEHICULO_CCS, 100)).toBe(250);
    expect(autonomiaKm(VEHICULO_CCS, 50)).toBe(125);
    expect(autonomiaKm(VEHICULO_CCS, 0)).toBe(0);
  });
});

describe('compatibilidad de conectores (regla simplificada)', () => {
  it.each([
    ['CCS', VEHICULO_CCS, 'CCS_COMBO', true],
    ['CCS', VEHICULO_CCS, 'TIPO_2', true],
    ['CCS', VEHICULO_CCS, 'CHADEMO', false],
    ['TIPO_2', VEHICULO_T2, 'TIPO_2', true],
    ['TIPO_2', VEHICULO_T2, 'CCS_COMBO', false],
    ['TIPO_2', VEHICULO_T2, 'CHADEMO', false],
    ['CHADEMO', VEHICULO_CHADEMO, 'CHADEMO', true],
    ['CHADEMO', VEHICULO_CHADEMO, 'TIPO_2', false],
    ['CHADEMO', VEHICULO_CHADEMO, 'CCS_COMBO', false],
  ] as const)('vehículo %s con cargador %s → %s', (_n, vehiculo, conector, esperado) => {
    expect(esCompatible(vehiculo, conector)).toBe(esperado);
  });

  it('un cargador DC exige que el vehículo admita carga DC', () => {
    const sinDc = { ...VEHICULO_CCS, potenciaMaxDcKw: null };
    expect(esCompatible(sinDc, 'CCS_COMBO')).toBe(false);
    expect(esCompatible(sinDc, 'TIPO_2')).toBe(true);
    expect(esCompatible({ ...VEHICULO_CHADEMO, potenciaMaxDcKw: null }, 'CHADEMO')).toBe(false);
  });
});

describe('alcance con margen de seguridad del 10 % y SoC mínimo de 5 %', () => {
  it('con 50 %: autonomía 125 km → útil 112.5 km', () => {
    expect(esAlcanzable(VEHICULO_CCS, 50, 112.5, CONFIG_MOTOR)).toBe(true);
    expect(esAlcanzable(VEHICULO_CCS, 50, 112.6, CONFIG_MOTOR)).toBe(false);
  });

  it('con poca batería manda el SoC mínimo de llegada', () => {
    // 30 %: margen permite 67.5 km, pero el SoC de llegada baja de 5 % pasados los 62.5 km
    expect(socLlegadaPct(VEHICULO_CCS, 30, 62.5)).toBe(5);
    expect(esAlcanzable(VEHICULO_CCS, 30, 62.5, CONFIG_MOTOR)).toBe(true);
    expect(esAlcanzable(VEHICULO_CCS, 30, 63, CONFIG_MOTOR)).toBe(false);
  });

  it('alcanceMaximoKm es el límite exacto de esAlcanzable', () => {
    expect(alcanceMaximoKm(VEHICULO_CCS, 50, CONFIG_MOTOR)).toBeCloseTo(112.5); // manda el margen
    expect(alcanceMaximoKm(VEHICULO_CCS, 30, CONFIG_MOTOR)).toBeCloseTo(62.5); // manda el SoC mínimo
    expect(alcanceMaximoKm(VEHICULO_CCS, 3, CONFIG_MOTOR)).toBe(0);
    for (const bateria of [8, 10, 30, 50, 90]) {
      const alcance = alcanceMaximoKm(VEHICULO_CCS, bateria, CONFIG_MOTOR);
      expect(esAlcanzable(VEHICULO_CCS, bateria, alcance - 0.01, CONFIG_MOTOR)).toBe(true);
      expect(esAlcanzable(VEHICULO_CCS, bateria, alcance + 0.01, CONFIG_MOTOR)).toBe(false);
    }
  });

  it('con batería 0 % solo es alcanzable un cargador a 0 km si el SoC mínimo lo permite', () => {
    expect(esAlcanzable(VEHICULO_CCS, 0, 0, CONFIG_MOTOR)).toBe(false);
  });
});

describe('potencia efectiva (límite del vehículo)', () => {
  it('AC: limitada por el cargador de a bordo', () => {
    expect(
      potenciaEfectivaKw(VEHICULO_CCS, { potenciaKw: 22, tipoConector: 'TIPO_2' }, 0.9),
    ).toBeCloseTo(9.9);
    expect(
      potenciaEfectivaKw(VEHICULO_CCS, { potenciaKw: 7.4, tipoConector: 'TIPO_2' }, 0.9),
    ).toBeCloseTo(6.66);
  });

  it('DC: limitada por el máximo DC del vehículo', () => {
    expect(
      potenciaEfectivaKw(VEHICULO_CCS, { potenciaKw: 150, tipoConector: 'CCS_COMBO' }, 0.9),
    ).toBeCloseTo(90);
    expect(
      potenciaEfectivaKw(VEHICULO_CCS, { potenciaKw: 50, tipoConector: 'CCS_COMBO' }, 0.9),
    ).toBeCloseTo(45);
  });
});

describe('energía, tiempo de carga y costo', () => {
  it('carga hasta 80 % si llega con poco', () => {
    const e = estimarCarga(VEHICULO_CCS, 40, 9.9, 400, CONFIG_MOTOR);
    expect(e.objetivoPct).toBe(80);
    expect(e.energiaKwh).toBeCloseTo(20);
    expect(e.cargaMin).toBeCloseTo((20 / 9.9) * 60);
    expect(e.costoEstimado).toBeCloseTo(8000);
  });

  it('si llega con más de 70 %, carga 10 puntos más (tope 100 %)', () => {
    expect(estimarCarga(VEHICULO_CCS, 75, 10, 400, CONFIG_MOTOR)).toMatchObject({
      objetivoPct: 85,
      energiaKwh: 5,
      cargaMin: 30,
      costoEstimado: 2000,
    });
    const casiLleno = estimarCarga(VEHICULO_CCS, 95, 10, 400, CONFIG_MOTOR);
    expect(casiLleno.objetivoPct).toBe(100);
    expect(casiLleno.energiaKwh).toBeCloseTo(2.5);
  });

  it('cargador gratuito → costo 0', () => {
    expect(estimarCarga(VEHICULO_CCS, 40, 10, 0, CONFIG_MOTOR).costoEstimado).toBe(0);
  });
});

describe('normalización min–max', () => {
  it('lleva el mínimo a 0 y el máximo a 1', () => {
    expect(normalizarMinMax([10, 20, 30])).toEqual([0, 0.5, 1]);
    expect(normalizarMinMax([5])).toEqual([0]);
  });

  it('si max = min, todos valen 0', () => {
    expect(normalizarMinMax([7, 7, 7])).toEqual([0, 0, 0]);
    expect(normalizarMinMax([7, 7, 7], 3)).toEqual([0, 0, 0]);
  });

  it('con rango mínimo, una diferencia chica no se amplifica a la escala completa (D-026)', () => {
    // 1.0 km vs 1.1 km con umbral de 3 km: 0.1 / 3 ≈ 0.033, no 1
    const [a, b] = normalizarMinMax([1.0, 1.1], 3);
    expect(a).toBe(0);
    expect(b).toBeCloseTo(0.0333, 3);
    // Si la diferencia real supera el umbral, es la min–max clásica
    expect(normalizarMinMax([10, 20, 30], 5)).toEqual([0, 0.5, 1]);
  });

  it('los rangos mínimos están configurados para los cuatro criterios', () => {
    expect(CONFIG_MOTOR.rangosMinimos).toEqual({
      distancia: 3,
      espera: 15,
      carga: 30,
      costo: 2000,
    });
  });
});

describe('pesos y WSM', () => {
  it('cada fila de pesos suma 1', () => {
    for (const pesos of Object.values(CONFIG_MOTOR.pesos)) {
      expect(Object.values(pesos).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    }
  });

  it('pesos de la tabla del SPEC por urgencia', () => {
    expect(CONFIG_MOTOR.pesos.alta).toEqual({
      distancia: 0.45,
      espera: 0.25,
      carga: 0.2,
      costo: 0.1,
    });
    expect(CONFIG_MOTOR.pesos.media).toEqual({
      distancia: 0.3,
      espera: 0.2,
      carga: 0.25,
      costo: 0.25,
    });
    expect(CONFIG_MOTOR.pesos.baja).toEqual({
      distancia: 0.15,
      espera: 0.15,
      carga: 0.2,
      costo: 0.5,
    });
  });

  it('score = 100 × (1 − Σ w·norm) y la suma de aportes es el score', () => {
    const [mejor, peor] = estrategiaWSM.puntuar(
      [
        { distancia: 1, espera: 0, carga: 30, costo: 1000 },
        { distancia: 5, espera: 0, carga: 30, costo: 1000 },
      ],
      CONFIG_MOTOR.pesos.alta,
    );
    expect(mejor!.score).toBeCloseTo(100);
    expect(peor!.score).toBeCloseTo(55); // pierde 45 puntos por distancia
    for (const p of [mejor!, peor!]) {
      const suma = Object.values(p.desglose).reduce((s, d) => s + d.aporte, 0);
      expect(suma).toBeCloseTo(p.score);
    }
    expect(peor!.desglose.distancia).toMatchObject({
      valor: 5,
      normalizado: 1,
      peso: 0.45,
      aporte: 0,
    });
  });
});

describe('tiempo local', () => {
  it('convierte un instante a minutos locales de Córdoba (UTC−3)', () => {
    const min = aMinutosLocales(AHORA, 'America/Argentina/Cordoba');
    expect(aFechaHora(min)).toEqual({ fecha: '2026-10-27', hora: '10:00' });
    expect(min).toBe(minutosLocales('2026-10-27', '10:00'));
    expect(diaDeLaSemana(min)).toBe('martes');
  });
});
