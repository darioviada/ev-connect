// Tipos del motor de recomendación (docs/SPEC.md §6). El motor es PURO: recibe datos y devuelve resultados,
// sin base de datos ni red. Así se testea de forma aislada y se reutiliza en `npm run validate`.

export type TipoConector = 'TIPO_2' | 'CCS_COMBO' | 'CHADEMO';
export type Urgencia = 'baja' | 'media' | 'alta';
export type Modo = 'ubicacion' | 'ruta';
export type DiaSemana =
  'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface VehiculoMotor {
  capacidadBateriaKwh: number;
  consumoKwhPor100km: number;
  tipoConector: TipoConector;
  potenciaMaxAcKw: number;
  /** null = el vehículo no admite carga en corriente continua */
  potenciaMaxDcKw: number | null;
}

/** Franja semanal de disponibilidad, en hora local ('HH:MM' o 'HH:MM:SS'). */
export interface FranjaMotor {
  dia: DiaSemana;
  inicio: string;
  fin: string;
}

/** Reserva activa (no cancelada) en hora local. */
export interface ReservaMotor {
  fecha: string; // 'YYYY-MM-DD'
  horaInicio: string;
  horaFin: string;
}

export interface CargadorMotor {
  id: string;
  nombre: string;
  tipo: 'publico' | 'privado';
  tipoConector: TipoConector;
  potenciaKw: number;
  precioKwh: number;
  ubicacion: LatLng;
  direccion?: string | null;
}

/** Distancia y tiempo de un tramo, según el RoutingProvider. */
export interface Trayecto {
  distanciaKm: number;
  duracionMin: number;
  fuente: string;
}

export interface CandidatoMotor {
  cargador: CargadorMotor;
  /** origen → cargador */
  desdeOrigen: Trayecto;
  /** cargador → destino (solo modo ruta) */
  haciaDestino?: Trayecto;
  /** Vacío = disponible 24/7. */
  franjas: FranjaMotor[];
  /** Solo reservas activas (pendientes o confirmadas). */
  reservas: ReservaMotor[];
}

export const CRITERIOS = ['distancia', 'espera', 'carga', 'costo'] as const;
export type Criterio = (typeof CRITERIOS)[number];
export type Pesos = Record<Criterio, number>;

export type MotivoDescarte = 'CONECTOR_INCOMPATIBLE' | 'FUERA_DE_AUTONOMIA' | 'SIN_DISPONIBILIDAD';

export interface Descarte {
  cargadorId: string;
  nombre: string;
  motivo: MotivoDescarte;
  detalle: string;
}

export type CodigoSinResultados =
  'SIN_CARGADORES_CERCANOS' | 'SIN_COMPATIBLES' | 'FUERA_DE_AUTONOMIA' | 'SIN_DISPONIBILIDAD';

export interface Metricas {
  /** origen → cargador */
  distanciaKm: number;
  /** Solo modo ruta: km extra respecto de ir directo al destino. */
  desvioKm?: number;
  viajeMin: number;
  /** Solo modo ruta: minutos extra respecto de ir directo. */
  desvioMin?: number;
  esperaMin: number;
  cargaMin: number;
  totalMin: number;
  energiaKwh: number;
  costoEstimado: number;
  potenciaEfectivaKw: number;
  socLlegadaPct: number;
  objetivoPct: number;
  /** Ventana de carga estimada en hora local (sirve para precargar la reserva). */
  horarioCarga: { fecha: string; horaInicio: string; horaFin: string };
}

export interface DetalleCriterio {
  /** Valor del criterio (km, min o ARS). */
  valor: number;
  /** 0 = el mejor entre los candidatos, 1 = el peor. */
  normalizado: number;
  peso: number;
  /** Puntos que aporta al score (la suma de los aportes es el score). */
  aporte: number;
}

export interface Recomendacion {
  cargador: CargadorMotor;
  metricas: Metricas;
  score: number;
  desglose: Record<Criterio, DetalleCriterio>;
  mejorOpcion: boolean;
  advertencias: string[];
}

export interface ResultadoMotor {
  urgencia: Urgencia;
  autonomiaActualKm: number;
  pesos: Pesos;
  estrategia: string;
  recomendaciones: Recomendacion[];
  descartados: Descarte[];
  /** null si hay al menos una recomendación. */
  sinResultados: { codigo: CodigoSinResultados; mensaje: string } | null;
}
