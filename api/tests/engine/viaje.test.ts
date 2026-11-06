// Plan de viaje en modo ruta (D-045). Los puntos están sobre el ecuador para que las distancias en línea
// recta sean exactas (1° de longitud = 111,195 km) y, con factor de circuito 1, los tramos den números redondos.
// Vehículo de prueba: 50 kWh, 20 kWh/100 km → con batería llena llega a 225 km (margen 0,9).
import { describe, expect, it } from 'vitest';
import { CONFIG_MOTOR, planificarViaje, recomendar } from '../../src/engine/index.js';
import { minutosLocales } from '../../src/engine/tiempo.js';
import type { CargadorRuta, LatLng } from '../../src/engine/tipos.js';
import type { ContextoViaje } from '../../src/engine/viaje.js';
import { AHORA, HOY, VEHICULO_CCS, candidato, cargador, entrada } from './fixtures.js';

const KM_POR_GRADO = (6371 * Math.PI) / 180;
const en = (km: number): LatLng => ({ lat: 0, lng: km / KM_POR_GRADO });

const rapido = (id: string, km: number, extra: Partial<CargadorRuta> = {}): CargadorRuta => ({
  cargador: cargador(id, { tipoConector: 'CCS_COMBO', potenciaKw: 100, ubicacion: en(km) }),
  franjas: [],
  reservas: [],
  ...extra,
});

function contexto(destinoKm: number, cargadores: CargadorRuta[]): ContextoViaje {
  return {
    vehiculo: VEHICULO_CCS,
    destino: en(destinoKm),
    distanciaTotalKm: destinoKm,
    factorCircuito: 1,
    minPorKm: 1,
    cargadores,
    config: CONFIG_MOTOR,
  };
}

const LAS_10 = minutosLocales(HOY, '10:00');
const inicioEn = (c: CargadorRuta, km: number, destinoKm: number, socLlegadaPct: number) => ({
  cargador: c,
  socLlegadaPct,
  llegadaMin: LAS_10,
  tramoKm: km,
  viajeMin: km,
  restanteKm: destinoKm - km,
});

describe('planificarViaje', () => {
  it('encadena paradas hasta el destino, cargando lo necesario para cada tramo + 10 puntos', () => {
    const a = rapido('a', 0);
    const plan = planificarViaje(
      contexto(600, [rapido('b', 200), rapido('c', 400)]),
      inicioEn(a, 0, 600, 50),
    );

    expect(plan.factible).toBe(true);
    expect(plan.paradas.map((p) => p.cargador.id)).toEqual(['a', 'b', 'c']);
    // 200 km consumen 80 %: hace falta salir con max(80 / 0,9; 80 + 5) = 88,9 % → +10 → 99 %
    expect(plan.paradas[0]!.objetivoPct).toBe(99);
    expect(plan.paradas[1]!.socLlegadaPct).toBe(19);
    expect(plan.paradas.map((p) => p.kmEnRuta)).toEqual([0, 200, 400]);
    expect(plan.llegada).toMatchObject({ tramoKm: 200, socPct: 19 });
    for (const p of plan.paradas) expect(p.socLlegadaPct).toBeGreaterThanOrEqual(5);
    expect(plan.totales.distanciaKm).toBe(600);
    expect(plan.problema).toBeNull();
  });

  it('si en el camino hay un tramo más largo que el alcance con batería llena, el viaje no es posible', () => {
    const a = rapido('a', 0);
    const plan = planificarViaje(
      contexto(600, [rapido('b', 200), rapido('d', 500)]),
      inicioEn(a, 0, 600, 50),
    );

    expect(plan.factible).toBe(false);
    expect(plan.llegada).toBeNull();
    expect(plan.problema).toMatchObject({
      motivo: 'SIN_ALCANCE',
      desdeNombre: 'Cargador b',
      desdeKm: 200,
      alcanceKm: 225,
      siguienteCargadorKm: 500,
    });
    expect(plan.problema!.mensaje).toMatch(/km 200 de 600.*a menos de 225 km.*km 500/);
  });

  it('informa cuando más adelante no hay ningún cargador compatible', () => {
    const plan = planificarViaje(contexto(600, []), inicioEn(rapido('a', 0), 0, 600, 50));
    expect(plan.problema!.siguienteCargadorKm).toBeNull();
    expect(plan.problema!.mensaje).toMatch(/no hay cargadores compatibles hasta el destino/);
  });

  it('elige las paradas que llegan antes: un cargador rápido aunque esté unos km antes', () => {
    const lento: CargadorRuta = {
      cargador: cargador('lento', { tipoConector: 'TIPO_2', potenciaKw: 7.4, ubicacion: en(180) }),
      franjas: [],
      reservas: [],
    };
    const plan = planificarViaje(
      contexto(380, [lento, rapido('rapido', 170)]),
      inicioEn(rapido('a', 0), 0, 380, 95),
    );
    expect(plan.paradas.map((p) => p.cargador.id)).toEqual(['a', 'rapido']);
  });

  it('no usa cargadores incompatibles ni cerrados a la hora de llegada', () => {
    const chademo: CargadorRuta = {
      cargador: cargador('chademo', {
        tipoConector: 'CHADEMO',
        potenciaKw: 50,
        ubicacion: en(200),
      }),
      franjas: [],
      reservas: [],
    };
    const cerrado = rapido('cerrado', 210, {
      franjas: [{ dia: 'domingo', inicio: '08:00', fin: '09:00' }],
    });
    const plan = planificarViaje(
      contexto(400, [chademo, cerrado]),
      inicioEn(rapido('a', 0), 0, 400, 50),
    );
    expect(plan.factible).toBe(false);
    expect(plan.problema!.motivo).toBe('SIN_DISPONIBILIDAD');
  });

  it('si el destino está al alcance, carga solo lo justo para llegar', () => {
    const plan = planificarViaje(contexto(100, []), inicioEn(rapido('a', 0), 0, 100, 10));
    // 100 km = 40 %: max(44,4; 45) + 10 → 55 %
    expect(plan.paradas).toHaveLength(1);
    expect(plan.paradas[0]!.objetivoPct).toBe(55);
    expect(plan.llegada!.socPct).toBe(15);
  });
});

describe('recomendar en modo ruta con plan de viaje', () => {
  const ruta = (destinoKm: number, extra = {}) => ({
    modo: 'ruta' as const,
    origen: en(0),
    destino: en(destinoKm),
    trayectoDirecto: { distanciaKm: destinoKm, duracionMin: destinoKm, fuente: 'test' },
    ahora: AHORA,
    ...extra,
  });
  const primera = (id: string, km: number, destinoKm: number) =>
    candidato(rapido(id, km).cargador, {
      km,
      min: km,
      alDestino: { km: destinoKm - km, min: destinoKm - km },
    });

  it('si con la batería actual se llega al destino, no arma plan', () => {
    const r = recomendar(entrada([primera('a', 10, 100)], { bateriaPct: 90, ...ruta(100) }));
    expect(r.viaje).toEqual({
      distanciaKm: 100,
      llegaSinCargar: true,
      alcanceConCargaCompletaKm: 225,
    });
    expect(r.recomendaciones[0]!.plan).toBeUndefined();
  });

  it('adjunta el plan, carga lo que pide el tramo siguiente y avisa las paradas extra', () => {
    const r = recomendar(
      entrada([primera('a', 100, 400)], {
        bateriaPct: 50,
        ...ruta(400),
        cargadoresRuta: [rapido('b', 250)],
      }),
    );
    const rec = r.recomendaciones[0]!;
    expect(rec.plan!.paradas.map((p) => p.cargador.id)).toEqual(['a', 'b']);
    // tramo a → b de 150 km = 60 %: max(66,7; 65) + 10 → 77 %
    expect(rec.metricas.objetivoPct).toBe(77);
    expect(rec.advertencias).toContain('El viaje necesita 1 parada más (ver el plan de viaje).');
    // Espera, carga y costo se puntúan para todo el viaje
    expect(rec.desglose.carga.valor).toBeCloseTo(rec.plan!.totales.cargaMin, 1);
  });

  it('si desde ninguna primera parada se completa el viaje → VIAJE_NO_POSIBLE con el lugar donde se corta', () => {
    const r = recomendar(entrada([primera('a', 2, 600)], { bateriaPct: 50, ...ruta(600) }));
    expect(r.recomendaciones).toEqual([]);
    expect(r.sinResultados!.codigo).toBe('VIAJE_NO_POSIBLE');
    expect(r.sinResultados!.mensaje).toMatch(/No es posible completar este viaje.*km 2 de 600/);
    expect(r.descartados[0]!.motivo).toBe('VIAJE_NO_POSIBLE');
  });

  it('descarta primeras paradas donde no hace falta cargar si hay otras opciones', () => {
    const r = recomendar(
      entrada([primera('a', 2, 350), primera('c', 150, 350)], { bateriaPct: 100, ...ruta(350) }),
    );
    expect(r.recomendaciones.map((x) => x.cargador.id)).toEqual(['c']);
    expect(r.descartados).toEqual([
      expect.objectContaining({ cargadorId: 'a', motivo: 'CARGA_INNECESARIA' }),
    ]);
  });

  it('descarta cargadores en sentido contrario al viaje si hay opciones hacia adelante (D-046)', () => {
    // 'atras' queda 5 km hacia el lado opuesto: desde ahí el destino está 5 km más lejos
    const atras = candidato(rapido('atras', -5).cargador, {
      km: 5,
      min: 5,
      alDestino: { km: 105, min: 105 },
    });
    const r = recomendar(
      entrada([atras, primera('adelante', 20, 100)], { bateriaPct: 90, ...ruta(100) }),
    );
    expect(r.recomendaciones.map((x) => x.cargador.id)).toEqual(['adelante']);
    expect(r.descartados).toEqual([
      expect.objectContaining({ cargadorId: 'atras', motivo: 'SENTIDO_CONTRARIO' }),
    ]);
    expect(r.descartados[0]!.detalle).toMatch(/5 km más lejos/);
  });

  it('si solo hay cargadores en sentido contrario, los mantiene con una advertencia', () => {
    const atras = candidato(rapido('atras', -5).cargador, {
      km: 5,
      min: 5,
      alDestino: { km: 105, min: 105 },
    });
    const r = recomendar(entrada([atras], { bateriaPct: 90, ...ruta(100) }));
    expect(r.recomendaciones[0]!.advertencias).toContain(
      'Queda en sentido contrario al viaje, pero no hay cargadores hacia adelante al alcance.',
    );
  });
});
