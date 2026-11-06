// ÚNICO lugar para ajustar el video: duración de cada escena (en segundos) y textos sobreimpresos.
// Al cambiar una duración, el inicio de las escenas siguientes se recalcula solo. Dentro de cada escena
// las animaciones usan fracciones de su duración, así que se estiran o acortan con ella.
// Guion: tesis/tfg-demo-docs/tfg-demo/docs/Guion video demo – EVConnect (TFG).md

export const FPS = 30;
export const ANCHO = 1920;
export const ALTO = 1080;

/** Datos del trabajo para los textos de apertura y cierre. */
export const CREDITOS = {
  producto: 'EVConnect',
  tipoTrabajo: 'Trabajo Final de Graduación',
  carrera: 'Ingeniería en Software',
  titulo: 'Sistema de recomendación optimizada de puntos de carga para vehículos eléctricos',
  autor: 'Darío Viada',
  universidad: 'Universidad Siglo 21',
  anio: '2026',
} as const;

export interface Escena {
  id: string;
  numero: number;
  nombre: string;
  /** Duración en segundos (según el guion; ajustar acá cuando esté la voz en off). */
  segundos: number;
  /** Rótulo breve con el nombre de la funcionalidad (opcional). */
  rotulo?: string;
}

export const ESCENAS: readonly Escena[] = [
  { id: 'apertura', numero: 1, nombre: 'Apertura', segundos: 20 },
  { id: 'roles', numero: 2, nombre: 'Roles', segundos: 20, rotulo: 'Tres roles' },
  {
    id: 'acceso',
    numero: 3,
    nombre: 'Registro e inicio de sesión',
    segundos: 15,
    rotulo: 'Acceso seguro',
  },
  { id: 'vehiculos', numero: 4, nombre: 'Mis vehículos', segundos: 25, rotulo: 'Mis vehículos' },
  { id: 'busqueda', numero: 5, nombre: 'Búsqueda', segundos: 40, rotulo: 'Búsqueda contextual' },
  {
    id: 'recomendaciones',
    numero: 6,
    nombre: 'Recomendaciones y mapa',
    segundos: 35,
    rotulo: 'Motor de recomendación',
  },
  {
    id: 'reserva',
    numero: 7,
    nombre: 'Detalle, reserva y seguimiento',
    segundos: 30,
    rotulo: 'Reservas',
  },
  {
    id: 'publicar',
    numero: 8,
    nombre: 'Publicar un cargador',
    segundos: 25,
    rotulo: 'Red colaborativa',
  },
  {
    id: 'favoritos',
    numero: 9,
    nombre: 'Favoritos y escritorio',
    segundos: 15,
    rotulo: 'Favoritos',
  },
  { id: 'cierre', numero: 10, nombre: 'Cierre', segundos: 15 },
];

export const aFrames = (segundos: number) => Math.round(segundos * FPS);

export interface TramoEscena extends Escena {
  inicio: number;
  duracion: number;
}

/** Línea de tiempo calculada: frame de inicio y duración (en frames) de cada escena. */
export const LINEA_DE_TIEMPO: readonly TramoEscena[] = ESCENAS.reduce<TramoEscena[]>(
  (acumulado, escena) => {
    const anterior = acumulado.at(-1);
    const inicio = anterior ? anterior.inicio + anterior.duracion : 0;
    return [...acumulado, { ...escena, inicio, duracion: aFrames(escena.segundos) }];
  },
  [],
);

export const DURACION_TOTAL = LINEA_DE_TIEMPO.reduce((total, e) => total + e.duracion, 0);

export const escena = (id: string): TramoEscena => {
  const e = LINEA_DE_TIEMPO.find((x) => x.id === id);
  if (!e) throw new Error(`Escena desconocida: ${id}`);
  return e;
};
