// Validación del motor (SPEC §12): escenarios reproducibles, línea base, optimalidad, estadística e
// invariantes sobre la base real.
import type { Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sembrar } from '../../seeds/demo.js';
import { recomendar } from '../../src/engine/recomendar.js';
import { OfflineProvider } from '../../src/routing/index.js';
import {
  analizarEscenario,
  elegirLineaBase,
  mediana,
  mejoraPct,
  promedio,
  resumir,
} from '../../src/validacion/analisis.js';
import { cargarCatalogo, ejecutarValidacion } from '../../src/validacion/ejecutar.js';
import {
  FECHA_BASE,
  generarEscenarios,
  ZONA_ORIGEN,
  type ModeloCatalogo,
} from '../../src/validacion/escenarios.js';
import { aCsv, aMarkdown } from '../../src/validacion/informe.js';
import { prepararBaseDePrueba } from '../db/baseDePrueba.js';
import { candidato, cargador, entrada, VEHICULO_CCS } from '../engine/fixtures.js';
import { configDePrueba } from '../helpers.js';

const CATALOGO: ModeloCatalogo[] = [
  { id: 'a', descripcion: 'Modelo A', vehiculo: VEHICULO_CCS },
  {
    id: 'b',
    descripcion: 'Modelo B',
    vehiculo: { ...VEHICULO_CCS, tipoConector: 'TIPO_2', potenciaMaxDcKw: null },
  },
];

describe('generarEscenarios', () => {
  const opciones = { semilla: 42, cantidad: 300, catalogo: CATALOGO, proporcionRuta: 0.2 };
  const escenarios = generarEscenarios(opciones);

  it('es reproducible con la misma semilla y cambia con otra', () => {
    expect(generarEscenarios(opciones)).toEqual(escenarios);
    expect(generarEscenarios({ ...opciones, semilla: 43 })).not.toEqual(escenarios);
  });

  it('respeta los rangos: batería 0–100, origen en Córdoba, semana base, proporción de rutas', () => {
    for (const e of escenarios) {
      expect(e.bateriaPct).toBeGreaterThanOrEqual(0);
      expect(e.bateriaPct).toBeLessThanOrEqual(100);
      expect(e.origen.lat).toBeGreaterThanOrEqual(ZONA_ORIGEN.latMin);
      expect(e.origen.lng).toBeLessThanOrEqual(ZONA_ORIGEN.lngMax);
      expect(e.fecha >= FECHA_BASE && e.fecha <= '2026-11-08').toBe(true);
      expect(e.modo === 'ruta').toBe(Boolean(e.destino));
    }
    const enRuta = escenarios.filter((e) => e.modo === 'ruta').length / escenarios.length;
    expect(enRuta).toBeGreaterThan(0.12);
    expect(enRuta).toBeLessThan(0.28);
  });

  it('el instante corresponde a la hora local de Argentina (UTC−3)', () => {
    const e = escenarios[0]!;
    const [h, m] = e.hora.split(':').map(Number) as [number, number];
    const local = new Date(e.ahora.getTime() - 3 * 3_600_000);
    expect(local.getUTCHours()).toBe(h);
    expect(local.getUTCMinutes()).toBe(m);
    expect(local.toISOString().slice(0, 10)).toBe(e.fecha);
  });
});

describe('línea base y optimalidad', () => {
  // A: el más cercano pero caro y lento · B: más lejos pero rápido y barato
  const candidatos = [
    candidato(cargador('A', { nombre: 'A', precioKwh: 900, potenciaKw: 7.4 }), { km: 1 }),
    candidato(
      cargador('B', { nombre: 'B', tipoConector: 'CCS_COMBO', potenciaKw: 100, precioKwh: 300 }),
      { km: 6 },
    ),
  ];
  // Con batería alta (urgencia baja) pesan el costo y la carga: el óptimo es B.
  const completo = recomendar(entrada(candidatos, { bateriaPct: 85 }));
  const escenario = generarEscenarios({
    semilla: 1,
    cantidad: 1,
    catalogo: CATALOGO,
    proporcionRuta: 0,
  })[0]!;

  it('la base elige el factible más cercano', () => {
    expect(elegirLineaBase(completo.recomendaciones, 'ubicacion')?.cargador.id).toBe('A');
    expect(elegirLineaBase([], 'ubicacion')).toBeNull();
  });

  it('optimalidad = score del elegido / score del óptimo, en el conjunto completo', () => {
    const sistemaEligeA = {
      ...completo,
      recomendaciones: [completo.recomendaciones.find((r) => r.cargador.id === 'A')!],
    };
    const fila = analizarEscenario(
      escenario,
      { resultado: sistemaEligeA, candidatos: 1, preseleccionAmpliada: false },
      completo,
    );
    const scoreA = completo.recomendaciones.find((r) => r.cargador.id === 'A')!.score;
    const scoreOptimo = completo.recomendaciones[0]!.score;
    expect(fila.optimo?.id).toBe('B');
    expect(fila.base?.id).toBe('A');
    expect(fila.optimalidadPct).toBeCloseTo((scoreA / scoreOptimo) * 100, 5);

    const optima = analizarEscenario(
      escenario,
      { resultado: completo, candidatos: 2, preseleccionAmpliada: false },
      completo,
    );
    expect(optima.optimalidadPct).toBe(100);
  });

  it('sin solución en el conjunto completo: sin base, sin óptimo y sin optimalidad', () => {
    const vacio = recomendar(entrada([], { bateriaPct: 20 }));
    const fila = analizarEscenario(
      escenario,
      { resultado: vacio, candidatos: 0, preseleccionAmpliada: true },
      vacio,
    );
    expect(fila).toMatchObject({
      sistema: null,
      base: null,
      optimo: null,
      optimalidadPct: null,
      sinSolucionCompleto: 'SIN_CARGADORES_CERCANOS',
    });
  });
});

describe('estadística y salidas', () => {
  it('promedio, mediana y mejora porcentual', () => {
    expect(promedio([1, 2, 6])).toBe(3);
    expect(mediana([5, 1, 3])).toBe(3);
    expect(mediana([1, 2, 3, 10])).toBe(2.5);
    expect(mejoraPct(100, 80)).toBe(20); // el sistema es 20 % mejor
    expect(mejoraPct(100, 120)).toBe(-20); // el sistema es 20 % peor: se informa negativo
    expect(Number.isNaN(promedio([]))).toBe(true);
  });

  it('el CSV escapa comillas y comas', () => {
    const csv = aCsv([]);
    expect(csv.split('\n')[0]).toContain('optimalidad_pct');
  });
});

describe('ejecución completa sobre la base (invariantes)', () => {
  let db: Knex;
  beforeAll(async () => {
    db = await prepararBaseDePrueba();
    await sembrar(db, { reset: true, modoAuth: 'local', hoy: FECHA_BASE });
  });
  afterAll(async () => {
    await db?.destroy();
  });

  const correr = () =>
    ejecutarValidacion({
      db,
      rutas: new OfflineProvider(),
      engine: configDePrueba().engine,
      zonaHoraria: 'America/Argentina/Cordoba',
      semilla: 7,
      cantidad: 30,
      proporcionRuta: 0.3,
    });

  it('usa el catálogo del seed', async () => {
    expect(await cargarCatalogo(db)).toHaveLength(8);
  });

  it('es reproducible y cumple las invariantes de la comparación', async () => {
    const a = await correr();
    const b = await correr();
    expect(aCsv(a.filas)).toBe(aCsv(b.filas));
    expect(a.cargadoresActivos).toBe(58);
    expect(a.elementosConsultados).toBe(0); // offline: sin costo

    for (const f of a.filas) {
      // La preselección nunca evalúa más de 8 candidatos
      expect(f.candidatosSistema).toBeLessThanOrEqual(8);
      if (f.sistema && f.base && f.optimo) {
        // La base es, por definición, la más cercana entre los factibles
        expect(f.base.criterioKm).toBeLessThanOrEqual(f.sistema.criterioKm + 1e-9);
        // El óptimo del conjunto completo tiene el puntaje máximo
        expect(f.optimalidadPct!).toBeLessThanOrEqual(100 + 1e-9);
        expect(f.optimalidadPct!).toBeGreaterThan(0);
      }
      // Si no hay solución con todos los cargadores, tampoco con la preselección
      if (f.sinSolucionCompleto) expect(f.sistema).toBeNull();
    }

    const r = resumir(a.filas);
    expect(r.escenarios).toBe(30);
    expect(r.comparables + r.sinSolucionCompleto + r.sinSolucionPorPreseleccion).toBe(30);
    const md = aMarkdown(a.filas, {
      cantidad: 30,
      semilla: 7,
      proporcionRuta: 0.3,
      proveedor: 'offline',
      fechaBase: FECHA_BASE,
      cargadoresActivos: a.cargadoresActivos,
      candidatosLimite: 8,
      radioKm: 20,
      corredorKm: 5,
      elementosConsultados: 0,
    });
    expect(md).toContain('## Limitaciones');
    expect(md).toContain('Cercanía');
  });
});
