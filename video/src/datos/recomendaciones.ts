// Recomendaciones fijas del video (guion, escena 6): Juan, Dolphin Mini al 18 %, ruta Casa → Trabajo.
// Datos de demostración, coherentes con las reglas del motor (urgencia alta: pesan más distancia y espera).
import type { Recomendacion } from '../../../web/src/api/tipos';

type Criterio = 'distancia' | 'espera' | 'carga' | 'costo';
const PESOS_ALTA: Record<Criterio, number> = {
  distancia: 0.45,
  espera: 0.25,
  carga: 0.2,
  costo: 0.1,
};

function desglose(valores: Record<Criterio, number>, normalizados: Record<Criterio, number>) {
  return Object.fromEntries(
    (Object.keys(PESOS_ALTA) as Criterio[]).map((c) => [
      c,
      {
        valor: valores[c],
        normalizado: normalizados[c],
        peso: PESOS_ALTA[c],
        aporte: Math.round(PESOS_ALTA[c] * (1 - normalizados[c]) * 1000) / 10,
      },
    ]),
  ) as Recomendacion['desglose'];
}

const horario = { fecha: '2026-11-06', horaInicio: '08:15', horaFin: '08:50' };

export const WALLBOX_GARCIA: Recomendacion = {
  cargador: {
    id: 'wallbox-garcia',
    nombre: 'Wallbox García',
    tipo: 'privado',
    tipoConector: 'CCS_COMBO',
    potenciaKw: 40,
    precioKwh: 450,
    ubicacion: { lat: -31.3991, lng: -64.2462 },
    direccion: 'Av. Fernando Fader 3950, Cerro de las Rosas',
  },
  metricas: {
    distanciaKm: 1.2,
    desvioKm: 0.4,
    viajeMin: 4,
    desvioMin: 1,
    esperaMin: 0,
    cargaMin: 35,
    totalMin: 39,
    energiaKwh: 21,
    costoEstimado: 9450,
    potenciaEfectivaKw: 36,
    socLlegadaPct: 17.6,
    objetivoPct: 73,
    horarioCarga: horario,
  },
  score: 91,
  desglose: desglose(
    { distancia: 0.4, espera: 0, carga: 35, costo: 9450 },
    { distancia: 0, espera: 0, carga: 0, costo: 0.2 },
  ),
  mejorOpcion: true,
  advertencias: ['Cargador privado: la reserva queda pendiente hasta que el dueño la acepte.'],
};

export const RUTA_9: Recomendacion = {
  cargador: {
    id: 'estacion-ruta-9',
    nombre: 'Estación de servicio Ruta 9',
    tipo: 'publico',
    tipoConector: 'CCS_COMBO',
    potenciaKw: 100,
    precioKwh: 780,
    ubicacion: { lat: -31.4072, lng: -64.2015 },
    direccion: 'Ruta 9 y Av. Circunvalación',
  },
  metricas: {
    distanciaKm: 3.8,
    desvioKm: 1.9,
    viajeMin: 9,
    desvioMin: 4,
    esperaMin: 0,
    cargaMin: 35,
    totalMin: 44,
    energiaKwh: 21,
    costoEstimado: 16380,
    potenciaEfectivaKw: 36,
    socLlegadaPct: 16.8,
    objetivoPct: 73,
    horarioCarga: horario,
  },
  score: 63,
  desglose: desglose(
    { distancia: 1.9, espera: 0, carga: 35, costo: 16380 },
    { distancia: 0.5, espera: 0, carga: 0, costo: 1 },
  ),
  mejorOpcion: false,
  advertencias: [],
};

export const SHOPPING_NORTE: Recomendacion = {
  cargador: {
    id: 'shopping-norte',
    nombre: 'Shopping Norte',
    tipo: 'publico',
    tipoConector: 'TIPO_2',
    potenciaKw: 22,
    precioKwh: 380,
    ubicacion: { lat: -31.4045, lng: -64.2231 },
    direccion: 'Estacionamiento del shopping',
  },
  metricas: {
    distanciaKm: 2.6,
    desvioKm: 1.1,
    viajeMin: 7,
    desvioMin: 3,
    esperaMin: 20,
    cargaMin: 128,
    totalMin: 155,
    energiaKwh: 21,
    costoEstimado: 7980,
    potenciaEfectivaKw: 5.9,
    socLlegadaPct: 17.1,
    objetivoPct: 73,
    horarioCarga: { fecha: '2026-11-06', horaInicio: '08:30', horaFin: '10:38' },
  },
  score: 48,
  desglose: desglose(
    { distancia: 1.1, espera: 20, carga: 128, costo: 7980 },
    { distancia: 0.3, espera: 1, carga: 1, costo: 0 },
  ),
  mejorOpcion: false,
  advertencias: ['Hay una reserva al llegar: se libera a las 08:30.'],
};

export const RECOMENDACIONES = [WALLBOX_GARCIA, RUTA_9, SHOPPING_NORTE] as const;
