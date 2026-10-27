// Reglas de dominio del motor (SPEC §6.2 a §6.4). Todas son simplificaciones documentadas:
// carga lineal sin curva, sin tráfico, ocupación solo por reservas.
import type { ConfigMotor } from './config.js';
import type { CargadorMotor, TipoConector, Urgencia, VehiculoMotor } from './tipos.js';

/** §6.2 — >70 % baja · 30–70 % media · <30 % alta. */
export function urgenciaDe(bateriaPct: number): Urgencia {
  if (bateriaPct > 70) return 'baja';
  if (bateriaPct >= 30) return 'media';
  return 'alta';
}

/** Autonomía actual en km = capacidad × (batería/100) / consumo × 100. */
export function autonomiaKm(vehiculo: VehiculoMotor, bateriaPct: number): number {
  return ((vehiculo.capacidadBateriaKwh * (bateriaPct / 100)) / vehiculo.consumoKwhPor100km) * 100;
}

const ES_DC: Record<TipoConector, boolean> = { TIPO_2: false, CCS_COMBO: true, CHADEMO: true };

// Regla simplificada: un vehículo CCS acepta CCS y Tipo 2; Tipo 2 solo Tipo 2; CHAdeMO solo CHAdeMO.
const ACEPTA: Record<TipoConector, readonly TipoConector[]> = {
  CCS_COMBO: ['CCS_COMBO', 'TIPO_2'],
  TIPO_2: ['TIPO_2'],
  CHADEMO: ['CHADEMO'],
};

/** §6.3.1 — compatibilidad de conector (un cargador DC exige que el vehículo admita DC). */
export function esCompatible(vehiculo: VehiculoMotor, conectorCargador: TipoConector): boolean {
  if (!ACEPTA[vehiculo.tipoConector].includes(conectorCargador)) return false;
  if (ES_DC[conectorCargador] && vehiculo.potenciaMaxDcKw === null) return false;
  return true;
}

/** SoC al llegar = batería − distancia × consumo / capacidad (en %). */
export function socLlegadaPct(vehiculo: VehiculoMotor, bateriaPct: number, distanciaKm: number) {
  return bateriaPct - (distanciaKm * vehiculo.consumoKwhPor100km) / vehiculo.capacidadBateriaKwh;
}

/** §6.3.2 — alcanzable con margen de seguridad y SoC mínimo de llegada. */
export function esAlcanzable(
  vehiculo: VehiculoMotor,
  bateriaPct: number,
  distanciaKm: number,
  config: Pick<ConfigMotor, 'margenSeguridad' | 'socMinimoLlegadaPct'>,
): boolean {
  return (
    autonomiaKm(vehiculo, bateriaPct) * config.margenSeguridad >= distanciaKm &&
    socLlegadaPct(vehiculo, bateriaPct, distanciaKm) >= config.socMinimoLlegadaPct
  );
}

/** Potencia efectiva = eficiencia × min(potencia del cargador, límite del vehículo para ese tipo de carga). */
export function potenciaEfectivaKw(
  vehiculo: VehiculoMotor,
  cargador: Pick<CargadorMotor, 'potenciaKw' | 'tipoConector'>,
  eficiencia: number,
): number {
  const limite = ES_DC[cargador.tipoConector]
    ? (vehiculo.potenciaMaxDcKw ?? 0)
    : vehiculo.potenciaMaxAcKw;
  return eficiencia * Math.min(cargador.potenciaKw, limite);
}

export interface EstimacionCarga {
  objetivoPct: number;
  energiaKwh: number;
  cargaMin: number;
  costoEstimado: number;
}

/** §6.4 — energía hasta el objetivo, tiempo de carga (lineal) y costo. */
export function estimarCarga(
  vehiculo: VehiculoMotor,
  socLlegada: number,
  potenciaEfectiva: number,
  precioKwh: number,
  config: Pick<ConfigMotor, 'objetivoMinimoPct' | 'objetivoExtraPct'>,
): EstimacionCarga {
  const objetivoPct = Math.min(
    100,
    Math.max(config.objetivoMinimoPct, socLlegada + config.objetivoExtraPct),
  );
  const energiaKwh = Math.max(0, ((objetivoPct - socLlegada) / 100) * vehiculo.capacidadBateriaKwh);
  return {
    objetivoPct,
    energiaKwh,
    cargaMin: potenciaEfectiva > 0 ? (energiaKwh / potenciaEfectiva) * 60 : Infinity,
    costoEstimado: energiaKwh * precioKwh,
  };
}
