// Tipos de las respuestas de la API (JSON camelCase). Ver api/src/modules/*.

export type TipoConector = 'TIPO_2' | 'CCS_COMBO' | 'CHADEMO';
export type DiaSemana =
  'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo';
export type Rol = 'user' | 'admin';
export type EstadoReserva = 'pendiente' | 'confirmada' | 'cancelada';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Paginado<T> {
  items: T[];
  paginacion: { limit: number; offset: number; total: number };
}

export interface Perfil {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  fechaRegistro: string;
  modoAuth: 'local' | 'cognito';
}

export interface DatosVehiculo {
  marca: string;
  modelo: string;
  capacidadBateriaKwh: number;
  consumoKwhPor100km: number;
  tipoConector: TipoConector;
  potenciaMaxAcKw: number;
  potenciaMaxDcKw: number | null;
}

export interface ModeloVehiculo extends DatosVehiculo {
  id: string;
}

export interface VehiculoUsuario extends ModeloVehiculo {
  modeloId: string | null;
  personalizado: boolean;
}

export interface Franja {
  dia: DiaSemana;
  horaInicio: string;
  horaFin: string;
}

export interface Cargador {
  id: string;
  nombre: string;
  direccion: string | null;
  tipo: 'publico' | 'privado';
  ubicacion: LatLng;
  tipoConector: TipoConector;
  potenciaKw: number;
  precioKwh: number;
  estado: 'activo' | 'inactivo';
  duenoId: string | null;
  disponibilidad?: Franja[];
}

export interface CargadorDetalle extends Cargador {
  disponibilidad: Franja[];
  ocupacion: { fecha: string; horaInicio: string; horaFin: string; estado: EstadoReserva }[];
}

export interface MiCargador extends Cargador {
  disponibilidad: Franja[];
  reservasPendientes: number;
}

export type Criterio = 'distancia' | 'espera' | 'carga' | 'costo';

export interface Recomendacion {
  cargador: {
    id: string;
    nombre: string;
    tipo: 'publico' | 'privado';
    tipoConector: TipoConector;
    potenciaKw: number;
    precioKwh: number;
    ubicacion: LatLng;
    direccion?: string | null;
  };
  metricas: {
    distanciaKm: number;
    desvioKm?: number;
    viajeMin: number;
    desvioMin?: number;
    esperaMin: number;
    cargaMin: number;
    totalMin: number;
    energiaKwh: number;
    costoEstimado: number;
    potenciaEfectivaKw: number;
    socLlegadaPct: number;
    objetivoPct: number;
    horarioCarga: { fecha: string; horaInicio: string; horaFin: string };
  };
  score: number;
  desglose: Record<Criterio, { valor: number; normalizado: number; peso: number; aporte: number }>;
  mejorOpcion: boolean;
  advertencias: string[];
}

export type VehiculoBusqueda =
  { modeloId: string } | { vehiculoUsuarioId: string } | { personalizado: DatosVehiculo };

export interface PedidoRecomendacion {
  vehiculo: VehiculoBusqueda;
  bateriaPct: number;
  modo: 'ubicacion' | 'ruta';
  origen: LatLng;
  destino?: LatLng;
}

export interface ResultadoRecomendacion {
  urgencia: 'baja' | 'media' | 'alta';
  autonomiaActualKm: number;
  pesos: Record<Criterio, number>;
  estrategia: string;
  recomendaciones: Recomendacion[];
  descartados: { cargadorId: string; nombre: string; motivo: string; detalle: string }[];
  sinResultados: { codigo: string; mensaje: string } | null;
  vehiculo: { descripcion: string } & Omit<DatosVehiculo, 'marca' | 'modelo'>;
  modo: 'ubicacion' | 'ruta';
  origen: LatLng;
  destino: LatLng | null;
  proveedorRutas: string;
  advertencias: string[];
  meta: {
    candidatosEvaluados: number;
    distanciaPreseleccionKm: number;
    preseleccionAmpliada: boolean;
    elementosConsultados: number;
    elementosDesdeCache: number;
  };
}

export interface Reserva {
  id: string;
  cargador: { id: string; nombre: string; direccion: string | null; tipo: 'publico' | 'privado' };
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estado: EstadoReserva;
  reservadaPor?: string;
  puedeCancelar: boolean;
}

export interface Lugar {
  nombre: string;
  descripcion: string;
  lat: number;
  lng: number;
}

export interface RutaGuardada {
  id: string;
  nombre: string;
  origen: LatLng;
  destino: LatLng;
}

export interface UsuarioAdmin {
  id: string;
  nombre: string;
  email: string;
  activo: boolean;
  fechaRegistro: string;
  rol: Rol | null;
}
