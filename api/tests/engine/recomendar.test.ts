// Motor completo: filtros, disponibilidad, scoring, orden, modo ruta y resultados vacíos.
import { describe, expect, it } from 'vitest';
import { evaluarDisponibilidad, recomendar } from '../../src/engine/index.js';
import { minutosLocales } from '../../src/engine/tiempo.js';
import {
  AHORA,
  candidato,
  cargador,
  entrada,
  HOY,
  VEHICULO_CHADEMO,
  VEHICULO_T2,
} from './fixtures.js';

const ids = (r: ReturnType<typeof recomendar>) => r.recomendaciones.map((x) => x.cargador.id);

describe('resultado global', () => {
  it('informa urgencia, autonomía, pesos y estrategia', () => {
    const r = recomendar(entrada([candidato(cargador('a'))], { bateriaPct: 45 }));
    expect(r.urgencia).toBe('media');
    expect(r.autonomiaActualKm).toBe(112.5);
    expect(r.pesos).toEqual({ distancia: 0.3, espera: 0.2, carga: 0.25, costo: 0.25 });
    expect(r.estrategia).toMatch(/WSM/);
    expect(r.sinResultados).toBeNull();
  });

  it('calcula las métricas de cada recomendación', () => {
    // 50 % y 10 km: llega con 46 %, carga a 80 % (17 kWh) a 9.9 kW (AC 22 kW limitado a 11 kW × 0.9)
    const r = recomendar(
      entrada([candidato(cargador('a', { precioKwh: 500 }), { km: 10, min: 15 })]),
    );
    const m = r.recomendaciones[0]!.metricas;
    expect(m).toMatchObject({
      distanciaKm: 10,
      viajeMin: 15,
      esperaMin: 0,
      socLlegadaPct: 46,
      objetivoPct: 80,
      energiaKwh: 17,
      potenciaEfectivaKw: 9.9,
      costoEstimado: 8500,
    });
    expect(m.cargaMin).toBeCloseTo((17 / 9.9) * 60, 1);
    expect(m.totalMin).toBeCloseTo(15 + (17 / 9.9) * 60, 1);
    expect(m.horarioCarga).toEqual({ fecha: HOY, horaInicio: '10:15', horaFin: '11:58' }); // 10:15 + 103 min
  });

  it('solo el primero es la mejor opción', () => {
    const r = recomendar(
      entrada([candidato(cargador('a'), { km: 1 }), candidato(cargador('b'), { km: 5 })]),
    );
    expect(r.recomendaciones.map((x) => x.mejorOpcion)).toEqual([true, false]);
  });
});

describe('las ponderaciones cambian el orden según la urgencia', () => {
  // A: cerca y caro · B: lejos y barato
  const candidatos = [
    candidato(cargador('A', { precioKwh: 800 }), { km: 2, min: 5 }),
    candidato(cargador('B', { precioKwh: 300 }), { km: 8, min: 15 }),
  ];

  it('urgencia alta (15 %) prioriza la distancia → A', () => {
    const r = recomendar(entrada(candidatos, { bateriaPct: 15 }));
    expect(r.urgencia).toBe('alta');
    expect(ids(r)).toEqual(['A', 'B']);
  });

  it('urgencia baja (85 %) prioriza el costo → B', () => {
    const r = recomendar(entrada(candidatos, { bateriaPct: 85 }));
    expect(r.urgencia).toBe('baja');
    expect(ids(r)).toEqual(['B', 'A']);
    expect(r.recomendaciones[0]!.score).toBe(85);
    expect(r.recomendaciones[1]!.score).toBe(50);
  });
});

describe('rango mínimo de normalización (D-026)', () => {
  // Caso real observado con el seed: el rápido está apenas 100 m más lejos que el lento.
  const candidatos = [
    candidato(cargador('lento-ac', { tipoConector: 'TIPO_2', potenciaKw: 11, precioKwh: 350 }), {
      km: 1.0,
      min: 2,
    }),
    candidato(
      cargador('rapido-dc', { tipoConector: 'CCS_COMBO', potenciaKw: 50, precioKwh: 650 }),
      {
        km: 1.1,
        min: 2,
      },
    ),
  ];

  it('con urgencia alta, 100 m de diferencia no ganan frente a horas de carga', () => {
    const r = recomendar(entrada(candidatos, { bateriaPct: 15 }));
    expect(ids(r)[0]).toBe('rapido-dc');
    const lento = r.recomendaciones.find((x) => x.cargador.id === 'lento-ac')!;
    expect(lento.metricas.cargaMin).toBeGreaterThan(180); // más de 3 horas de carga
  });

  it('sin rango mínimo (min–max clásica del SPEC) el resultado se invierte', () => {
    const r = recomendar(
      entrada(candidatos, {
        bateriaPct: 15,
        config: { rangosMinimos: { distancia: 0, espera: 0, carga: 0, costo: 0 } },
      }),
    );
    expect(ids(r)[0]).toBe('lento-ac');
  });
});

describe('desempate', () => {
  it('a igual score, gana el de menor distancia y luego el nombre', () => {
    // Modo ruta, 90 %: mismo desvío, misma energía (5 kWh), mismo costo → mismo score
    const r = recomendar(
      entrada(
        [
          candidato(cargador('lejos', { nombre: 'Alfa' }), {
            km: 10,
            alDestino: { km: 20, min: 20 },
          }),
          candidato(cargador('cerca-b', { nombre: 'Beta' }), {
            km: 4,
            alDestino: { km: 26, min: 20 },
          }),
          candidato(cargador('cerca-a', { nombre: 'Acme' }), {
            km: 4,
            alDestino: { km: 26, min: 20 },
          }),
        ],
        {
          bateriaPct: 90,
          modo: 'ruta',
          destino: { lat: -31.42, lng: -64.5 },
          trayectoDirecto: { distanciaKm: 30, duracionMin: 20, fuente: 'test' },
        },
      ),
    );
    expect(new Set(r.recomendaciones.map((x) => x.score)).size).toBe(1);
    expect(ids(r)).toEqual(['cerca-a', 'cerca-b', 'lejos']);
  });
});

describe('filtros excluyentes y códigos de resultado vacío', () => {
  it('sin candidatos → SIN_CARGADORES_CERCANOS', () => {
    const r = recomendar(entrada([]));
    expect(r.sinResultados?.codigo).toBe('SIN_CARGADORES_CERCANOS');
    expect(r.recomendaciones).toEqual([]);
  });

  it('ninguno compatible → SIN_COMPATIBLES con el motivo de cada descarte', () => {
    const r = recomendar(
      entrada([candidato(cargador('dc', { tipoConector: 'CCS_COMBO', potenciaKw: 50 }))], {
        vehiculo: VEHICULO_T2,
      }),
    );
    expect(r.sinResultados?.codigo).toBe('SIN_COMPATIBLES');
    expect(r.descartados).toEqual([
      expect.objectContaining({ cargadorId: 'dc', motivo: 'CONECTOR_INCOMPATIBLE' }),
    ]);
  });

  it('compatibles pero lejos → FUERA_DE_AUTONOMIA', () => {
    const r = recomendar(entrada([candidato(cargador('lejos'), { km: 200 })], { bateriaPct: 20 }));
    expect(r.sinResultados?.codigo).toBe('FUERA_DE_AUTONOMIA');
    expect(r.descartados[0]?.motivo).toBe('FUERA_DE_AUTONOMIA');
  });

  it('al alcance pero sin horario libre → SIN_DISPONIBILIDAD', () => {
    const r = recomendar(
      entrada([
        candidato(cargador('cerrado'), {
          franjas: [{ dia: 'sabado', inicio: '09:00', fin: '21:00' }],
        }),
      ]),
    );
    expect(r.sinResultados?.codigo).toBe('SIN_DISPONIBILIDAD');
    expect(r.descartados[0]?.motivo).toBe('SIN_DISPONIBILIDAD');
  });

  it('aplica los filtros en orden y registra el primer motivo de cada descarte', () => {
    const r = recomendar(
      entrada(
        [
          candidato(cargador('ok', { tipoConector: 'CHADEMO', potenciaKw: 50 }), { km: 3 }),
          // incompatible y además lejos: cuenta como incompatible
          candidato(cargador('incompatible-lejos', { tipoConector: 'TIPO_2' }), { km: 500 }),
          candidato(cargador('lejos', { tipoConector: 'CHADEMO', potenciaKw: 50 }), { km: 500 }),
        ],
        { vehiculo: VEHICULO_CHADEMO },
      ),
    );
    expect(ids(r)).toEqual(['ok']);
    expect(r.descartados.map((d) => [d.cargadorId, d.motivo])).toEqual([
      ['incompatible-lejos', 'CONECTOR_INCOMPATIBLE'],
      ['lejos', 'FUERA_DE_AUTONOMIA'],
    ]);
  });
});

describe('disponibilidad', () => {
  const llegada = minutosLocales(HOY, '10:00'); // martes
  const base = { llegadaMin: llegada, duracionMin: 60, esperaMaximaMin: 120 };

  it('sin franjas ni reservas: 24/7, sin espera', () => {
    expect(evaluarDisponibilidad({ ...base, franjas: [], reservas: [] })).toMatchObject({
      disponible: true,
      esperaMin: 0,
    });
  });

  it('dentro de la franja: sin espera', () => {
    const r = evaluarDisponibilidad({
      ...base,
      franjas: [{ dia: 'martes', inicio: '08:00', fin: '20:00' }],
      reservas: [],
    });
    expect(r).toMatchObject({ disponible: true, esperaMin: 0 });
  });

  it('fuera de franja y abre dentro de 120 min: espera hasta la apertura', () => {
    const r = evaluarDisponibilidad({
      ...base,
      franjas: [{ dia: 'martes', inicio: '11:30:00', fin: '20:00:00' }],
      reservas: [],
    });
    expect(r).toMatchObject({ disponible: true, esperaMin: 90, esperaPorHorario: true });
  });

  it('abre en más de 120 min: se descarta', () => {
    const r = evaluarDisponibilidad({
      ...base,
      franjas: [{ dia: 'martes', inicio: '12:01', fin: '20:00' }],
      reservas: [],
    });
    expect(r.disponible).toBe(false);
  });

  it('la carga completa debe entrar en la franja', () => {
    const r = evaluarDisponibilidad({
      ...base,
      franjas: [{ dia: 'martes', inicio: '08:00', fin: '10:30' }], // cierra antes de terminar
      reservas: [],
    });
    expect(r.disponible).toBe(false);
  });

  it('reserva solapada: espera a que termine', () => {
    const r = evaluarDisponibilidad({
      ...base,
      franjas: [],
      reservas: [{ fecha: HOY, horaInicio: '09:30', horaFin: '10:45' }],
    });
    expect(r).toMatchObject({ disponible: true, esperaMin: 45, esperaPorReserva: true });
  });

  it('reservas encadenadas: itera hasta encontrar un hueco donde entra la carga', () => {
    const r = evaluarDisponibilidad({
      ...base,
      franjas: [],
      reservas: [
        { fecha: HOY, horaInicio: '09:30', horaFin: '10:30' },
        { fecha: HOY, horaInicio: '11:00', horaFin: '11:30' }, // el hueco de 30 min no alcanza
      ],
    });
    expect(r).toMatchObject({ disponible: true, esperaMin: 90 });
  });

  it('una reserva que termina justo al llegar no genera espera', () => {
    const r = evaluarDisponibilidad({
      ...base,
      franjas: [],
      reservas: [{ fecha: HOY, horaInicio: '09:00', horaFin: '10:00' }],
    });
    expect(r).toMatchObject({ disponible: true, esperaMin: 0 });
  });

  it('ocupado más de 120 min: se descarta', () => {
    const r = evaluarDisponibilidad({
      ...base,
      franjas: [],
      reservas: [{ fecha: HOY, horaInicio: '09:00', horaFin: '12:30' }],
    });
    expect(r.disponible).toBe(false);
  });

  it('combina reserva y horario: tras la reserva, la franja ya cerró y no vuelve a abrir a tiempo', () => {
    const r = evaluarDisponibilidad({
      ...base,
      franjas: [{ dia: 'martes', inicio: '08:00', fin: '11:00' }],
      reservas: [{ fecha: HOY, horaInicio: '09:30', horaFin: '10:30' }],
    });
    expect(r.disponible).toBe(false);
  });

  it('cruza la medianoche hacia la franja del día siguiente', () => {
    const r = evaluarDisponibilidad({
      llegadaMin: minutosLocales(HOY, '23:30'),
      duracionMin: 30,
      esperaMaximaMin: 120,
      franjas: [{ dia: 'miercoles', inicio: '00:00', fin: '06:00' }],
      reservas: [],
    });
    expect(r).toMatchObject({ disponible: true, esperaMin: 30 });
  });

  it('en el motor: la espera entra en las métricas y en las advertencias', () => {
    const r = recomendar(
      entrada([
        candidato(cargador('a'), {
          km: 1,
          min: 0,
          reservas: [{ fecha: HOY, horaInicio: '09:00', horaFin: '10:20' }],
        }),
      ]),
    );
    const rec = r.recomendaciones[0]!;
    expect(rec.metricas.esperaMin).toBe(20);
    expect(rec.metricas.horarioCarga.horaInicio).toBe('10:20');
    expect(rec.advertencias.join(' ')).toMatch(/reserva/);
  });
});

describe('modo ruta', () => {
  const ruta = {
    modo: 'ruta' as const,
    destino: { lat: -31.4241, lng: -64.4978 },
    trayectoDirecto: { distanciaKm: 40, duracionMin: 40, fuente: 'test' },
  };

  it('calcula el desvío y lo usa como criterio de distancia', () => {
    const r = recomendar(
      entrada(
        [
          // sobre el camino: 15 + 25 = 40 → desvío 0
          candidato(cargador('en-ruta'), { km: 15, min: 15, alDestino: { km: 25, min: 25 } }),
          // más cerca del origen pero fuera del camino: 3 + 45 = 48 → desvío 8
          candidato(cargador('fuera'), { km: 3, min: 5, alDestino: { km: 45, min: 42 } }),
        ],
        { ...ruta, bateriaPct: 15 },
      ),
    );
    expect(ids(r)[0]).toBe('en-ruta');
    const porId = Object.fromEntries(r.recomendaciones.map((x) => [x.cargador.id, x]));
    expect(porId['en-ruta']!.metricas).toMatchObject({ desvioKm: 0, desvioMin: 0 });
    expect(porId['fuera']!.metricas).toMatchObject({ desvioKm: 8, desvioMin: 7 });
    expect(porId['fuera']!.desglose.distancia.valor).toBe(8);
  });

  it('el desvío nunca es negativo (estimaciones inconsistentes del proveedor)', () => {
    const r = recomendar(
      entrada([candidato(cargador('a'), { km: 10, alDestino: { km: 25, min: 20 } })], ruta),
    );
    expect(r.recomendaciones[0]!.metricas.desvioKm).toBe(0);
  });

  it('exige destino, trayecto directo y tramo al destino de cada candidato', () => {
    expect(() => recomendar(entrada([candidato(cargador('a'))], { modo: 'ruta' }))).toThrow(
      TypeError,
    );
    expect(() => recomendar(entrada([candidato(cargador('a'))], ruta))).toThrow(/haciaDestino/);
  });
});

describe('validación de la entrada y advertencias', () => {
  it('rechaza baterías fuera de 0–100', () => {
    expect(() => recomendar(entrada([], { bateriaPct: 101 }))).toThrow(RangeError);
    expect(() => recomendar(entrada([], { bateriaPct: -1 }))).toThrow(RangeError);
  });

  it('advierte poca batería al llegar y reserva sujeta a aprobación en privados', () => {
    const r = recomendar(
      entrada([candidato(cargador('p', { tipo: 'privado' }), { km: 20 })], { bateriaPct: 15 }),
    );
    const advertencias = r.recomendaciones[0]!.advertencias.join(' ');
    expect(advertencias).toMatch(/poca batería/);
    expect(advertencias).toMatch(/dueño la acepte/);
  });

  it('el reloj es inyectable: misma entrada y misma hora → mismo resultado', () => {
    const e = entrada([candidato(cargador('a')), candidato(cargador('b'), { km: 7 })]);
    expect(recomendar(e)).toEqual(recomendar({ ...e, ahora: new Date(AHORA) }));
  });
});
