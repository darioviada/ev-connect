// Datos de prueba del motor. Números redondos para poder calcular los resultados esperados a mano.
import type { EntradaMotor } from '../../src/engine/index.js';
import type {
  CandidatoMotor,
  CargadorMotor,
  FranjaMotor,
  ReservaMotor,
  VehiculoMotor,
} from '../../src/engine/tipos.js';

/** 50 kWh, 20 kWh/100 km → 250 km con batería llena; CCS con AC 11 kW y DC 100 kW. */
export const VEHICULO_CCS: VehiculoMotor = {
  capacidadBateriaKwh: 50,
  consumoKwhPor100km: 20,
  tipoConector: 'CCS_COMBO',
  potenciaMaxAcKw: 11,
  potenciaMaxDcKw: 100,
};
export const VEHICULO_T2: VehiculoMotor = {
  ...VEHICULO_CCS,
  tipoConector: 'TIPO_2',
  potenciaMaxDcKw: null,
};
export const VEHICULO_CHADEMO: VehiculoMotor = {
  ...VEHICULO_CCS,
  tipoConector: 'CHADEMO',
  potenciaMaxDcKw: 50,
};

/** Martes 27/10/2026, 10:00 en Córdoba (UTC−3). */
export const AHORA = new Date('2026-10-27T13:00:00Z');
export const HOY = '2026-10-27';

export function cargador(id: string, extra: Partial<CargadorMotor> = {}): CargadorMotor {
  return {
    id,
    nombre: `Cargador ${id}`,
    tipo: 'publico',
    tipoConector: 'TIPO_2',
    potenciaKw: 22,
    precioKwh: 400,
    ubicacion: { lat: -31.42, lng: -64.19 },
    ...extra,
  };
}

export function candidato(
  c: CargadorMotor,
  opciones: {
    km?: number;
    min?: number;
    franjas?: FranjaMotor[];
    reservas?: ReservaMotor[];
    alDestino?: { km: number; min: number };
  } = {},
): CandidatoMotor {
  return {
    cargador: c,
    desdeOrigen: { distanciaKm: opciones.km ?? 2, duracionMin: opciones.min ?? 0, fuente: 'test' },
    ...(opciones.alDestino
      ? {
          haciaDestino: {
            distanciaKm: opciones.alDestino.km,
            duracionMin: opciones.alDestino.min,
            fuente: 'test',
          },
        }
      : {}),
    franjas: opciones.franjas ?? [],
    reservas: opciones.reservas ?? [],
  };
}

export function entrada(
  candidatos: CandidatoMotor[],
  extra: Partial<EntradaMotor> = {},
): EntradaMotor {
  return {
    vehiculo: VEHICULO_CCS,
    bateriaPct: 50,
    modo: 'ubicacion',
    origen: { lat: -31.42, lng: -64.19 },
    ahora: AHORA,
    candidatos,
    ...extra,
  };
}
