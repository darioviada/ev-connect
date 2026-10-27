// DATOS SINTÉTICOS DE DEMOSTRACIÓN — generador determinista (semilla fija).
// Función pura: no toca la base. Con la misma semilla y la misma fecha produce exactamente los mismos datos.
// Nombres, direcciones, precios y ocupación son ficticios; no representan cargadores ni personas reales.
import { crearAleatorio, uuidDeterministico as uuid } from './aleatorio.js';
import { CATALOGO, type ModeloSeed, type TipoConector } from './datos/catalogo.js';
import { ANCLAS, ZONAS, type ZonaSeed } from './datos/zonas.js';
import { DIAS_SEMANA, diaDeLaSemana, sumarDias, type DiaSemana } from './fechas.js';

export const SEMILLA = 20261027;

export interface Franja {
  dia: DiaSemana;
  inicio: string; // HH:MM
  fin: string; // HH:MM
}

export interface UsuarioSeed {
  id: string;
  clave: string;
  cognitoSub: string;
  nombre: string;
  email: string;
  /** Solo usuarios de demostración con acceso en modo local. */
  credencial?: { password: string; rol: 'user' | 'admin' };
}

export interface CargadorSeed {
  id: string;
  clave: string;
  usuarioId: string | null;
  nombre: string;
  direccion: string;
  tipo: 'publico' | 'privado';
  lat: number;
  lng: number;
  tipoConector: TipoConector;
  potencia: number;
  precioKwh: number;
  estado: 'activo' | 'inactivo';
  /** Vacío = disponible 24/7. */
  franjas: Franja[];
  zona: ZonaSeed;
}

export interface ReservaSeed {
  id: string;
  usuarioId: string;
  cargadorId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estado: 'pendiente' | 'confirmada' | 'cancelada';
}

export interface VehiculoUsuarioSeed {
  id: string;
  usuarioId: string;
  modeloId: string;
}

export interface DatosSeed {
  modelos: (ModeloSeed & { id: string })[];
  usuarios: UsuarioSeed[];
  cargadores: CargadorSeed[];
  vehiculos: VehiculoUsuarioSeed[];
  reservas: ReservaSeed[];
  favoritos: { id: string; usuarioId: string; cargadorId: string }[];
  rutas: {
    id: string;
    usuarioId: string;
    nombre: string;
    origen: { lat: number; lng: number };
    destino: { lat: number; lng: number };
  }[];
}

export interface OpcionesGenerar {
  /** Fecha de referencia 'YYYY-MM-DD' (hoy en la zona horaria de negocio). */
  hoy: string;
  /** false en modo Cognito: no se crean los usuarios de demostración con contraseña. */
  incluirUsuariosDemo: boolean;
  semilla?: number;
}

// --- Usuarios ---------------------------------------------------------------------------------

export const USUARIOS_DEMO = {
  admin: { email: 'admin@demo.local', password: 'Admin123!', nombre: 'Admin Demo', rol: 'admin' },
  usuario: {
    email: 'usuario@demo.local',
    password: 'Usuario123!',
    nombre: 'Usuario Demo',
    rol: 'user',
  },
} as const;

// Personas ficticias dueñas de los cargadores privados (sin acceso: no tienen credenciales).
const NOMBRES = [
  'Ana',
  'Bruno',
  'Carla',
  'Diego',
  'Elena',
  'Facundo',
  'Gabriela',
  'Hernán',
  'Inés',
  'Julián',
  'Karina',
  'Lucas',
  'Micaela',
  'Nicolás',
  'Olga',
  'Pablo',
  'Romina',
  'Santiago',
  'Tamara',
  'Valentín',
  'Ximena',
  'Agustín',
  'Belén',
  'Camilo',
  'Daniela',
];
const APELLIDOS = [
  'García',
  'Fernández',
  'López',
  'Martínez',
  'Rodríguez',
  'Gómez',
  'Pérez',
  'Sánchez',
  'Romero',
  'Díaz',
  'Álvarez',
  'Torres',
  'Ruiz',
  'Ramírez',
  'Flores',
  'Acosta',
  'Benítez',
  'Medina',
  'Herrera',
  'Suárez',
  'Aguirre',
  'Giménez',
  'Molina',
  'Castro',
  'Ortiz',
];

function crearAnfitriones(): UsuarioSeed[] {
  return NOMBRES.map((nombre, i) => {
    const n = String(i + 1).padStart(2, '0');
    const clave = `anfitrion-${n}`;
    return {
      id: uuid(`usuario:${clave}`),
      clave,
      cognitoSub: uuid(`sub:${clave}`),
      nombre: `${nombre} ${APELLIDOS[i]!}`,
      email: `${clave}@demo.local`,
    };
  });
}

function crearUsuariosDemo(): UsuarioSeed[] {
  return (['admin', 'usuario'] as const).map((clave) => {
    const u = USUARIOS_DEMO[clave];
    return {
      id: uuid(`usuario:${clave}`),
      clave,
      cognitoSub: uuid(`sub:${clave}`),
      nombre: u.nombre,
      email: u.email,
      credencial: { password: u.password, rol: u.rol },
    };
  });
}

// --- Cargadores -------------------------------------------------------------------------------

interface Plantilla {
  conector: TipoConector;
  potencia: number;
  precio: [number, number]; // rango ARS/kWh (ficticio)
}

const PUBLICOS_CIUDAD: readonly Plantilla[] = [
  { conector: 'TIPO_2', potencia: 22, precio: [380, 450] },
  { conector: 'CCS_COMBO', potencia: 50, precio: [620, 720] },
  { conector: 'CHADEMO', potencia: 50, precio: [620, 700] },
  { conector: 'TIPO_2', potencia: 22, precio: [380, 450] },
  { conector: 'CCS_COMBO', potencia: 100, precio: [700, 800] },
  { conector: 'TIPO_2', potencia: 22, precio: [380, 450] },
  { conector: 'CCS_COMBO', potencia: 150, precio: [780, 880] },
];

// En ruta predominan los cargadores rápidos.
const PUBLICOS_RUTA: readonly Plantilla[] = [
  { conector: 'CCS_COMBO', potencia: 100, precio: [700, 800] },
  { conector: 'CHADEMO', potencia: 50, precio: [620, 700] },
  { conector: 'CCS_COMBO', potencia: 150, precio: [780, 880] },
  { conector: 'CCS_COMBO', potencia: 50, precio: [620, 720] },
  { conector: 'TIPO_2', potencia: 22, precio: [380, 450] },
];

const TIPOS_LUGAR_PUBLICO = [
  'Electrolinera',
  'Playón de carga',
  'Estacionamiento',
  'Estación de servicio',
];
const PREFIJOS_PRIVADO = ['Wallbox', 'Cochera', 'Garage', 'Casa'];

// Patrones de disponibilidad de los privados (vacío = 24/7).
const LUNES_A_VIERNES = DIAS_SEMANA.slice(0, 5);
const FIN_DE_SEMANA = DIAS_SEMANA.slice(5);
const franjas = (dias: readonly DiaSemana[], inicio: string, fin: string): Franja[] =>
  dias.map((dia) => ({ dia, inicio, fin }));

const PATRONES_PRIVADO: readonly Franja[][] = [
  franjas(LUNES_A_VIERNES, '08:00', '20:00'),
  franjas(FIN_DE_SEMANA, '09:00', '21:00'),
  franjas(DIAS_SEMANA, '18:00', '23:00'),
  [...franjas(LUNES_A_VIERNES, '19:00', '23:00'), ...franjas(FIN_DE_SEMANA, '08:00', '22:00')],
  franjas(DIAS_SEMANA, '07:00', '22:00'),
  [],
];

const HORARIO_ESTACIONAMIENTO: Franja[] = [
  ...franjas(DIAS_SEMANA.slice(0, 6), '08:00', '22:00'),
  ...franjas(['domingo'], '10:00', '20:00'),
];

/** Índices (en el orden de generación) de privados que quedan inactivos, para probar el filtro. */
const PRIVADOS_INACTIVOS = new Set([7, 23]);

const redondear = (x: number, decimales: number) => Number(x.toFixed(decimales));

function nombreLugar(zona: ZonaSeed): string {
  return zona.ciudad === 'Córdoba' ? zona.nombre : `${zona.nombre}, ${zona.ciudad}`;
}

function crearCargadores(
  aleatorio: ReturnType<typeof crearAleatorio>,
  anfitriones: UsuarioSeed[],
): CargadorSeed[] {
  const cargadores: CargadorSeed[] = [];
  let iPublicoCiudad = 0;
  let iPublicoRuta = 0;
  let iPrivado = 0;
  let iPublico = 0; // contador global: cargadores públicos de una misma zona reciben tipos de lugar distintos

  const ubicar = (zona: ZonaSeed) => ({
    lat: redondear(zona.lat + aleatorio.entre(-zona.dispersion, zona.dispersion), 6),
    lng: redondear(zona.lng + aleatorio.entre(-zona.dispersion, zona.dispersion), 6),
  });
  const precio = ([min, max]: [number, number]) => Math.round(aleatorio.entre(min, max) / 10) * 10;

  for (const zona of ZONAS) {
    for (let k = 0; k < zona.publicos; k++) {
      const enRuta = zona.grupo.startsWith('corredor');
      const plantilla = enRuta
        ? PUBLICOS_RUTA[iPublicoRuta++ % PUBLICOS_RUTA.length]!
        : PUBLICOS_CIUDAD[iPublicoCiudad++ % PUBLICOS_CIUDAD.length]!;
      const tipoLugar = TIPOS_LUGAR_PUBLICO[iPublico++ % TIPOS_LUGAR_PUBLICO.length]!;
      const clave = `publico:${zona.clave}:${k + 1}`;
      cargadores.push({
        id: uuid(`cargador:${clave}`),
        clave,
        usuarioId: null,
        nombre: `${tipoLugar} ${nombreLugar(zona)}`,
        direccion: `${zona.nombre}, ${zona.ciudad} (dirección de ejemplo)`,
        tipo: 'publico',
        ...ubicar(zona),
        tipoConector: plantilla.conector,
        potencia: plantilla.potencia,
        precioKwh: precio(plantilla.precio),
        estado: 'activo',
        franjas: tipoLugar === 'Estacionamiento' ? HORARIO_ESTACIONAMIENTO : [],
        zona,
      });
    }

    for (let k = 0; k < zona.privados; k++) {
      const indice = iPrivado++;
      const dueno = anfitriones[indice % anfitriones.length]!;
      const apellido = dueno.nombre.split(' ').slice(1).join(' ');
      const r = aleatorio.siguiente();
      const plantilla: Plantilla =
        r < 0.6
          ? { conector: 'TIPO_2', potencia: 7.4, precio: [250, 400] }
          : r < 0.8
            ? { conector: 'TIPO_2', potencia: 11, precio: [280, 420] }
            : r < 0.92
              ? { conector: 'TIPO_2', potencia: 22, precio: [300, 450] }
              : { conector: 'CCS_COMBO', potencia: 30, precio: [450, 600] };
      const clave = `privado:${zona.clave}:${k + 1}`;
      cargadores.push({
        id: uuid(`cargador:${clave}`),
        clave,
        usuarioId: dueno.id,
        nombre: `${PREFIJOS_PRIVADO[indice % PREFIJOS_PRIVADO.length]!} ${apellido}`,
        direccion: `${zona.nombre}, ${zona.ciudad} (dirección de ejemplo)`,
        tipo: 'privado',
        ...ubicar(zona),
        tipoConector: plantilla.conector,
        potencia: plantilla.potencia,
        precioKwh: precio(plantilla.precio),
        estado: PRIVADOS_INACTIVOS.has(indice) ? 'inactivo' : 'activo',
        franjas: aleatorio.elegir(PATRONES_PRIVADO),
        zona,
      });
    }
  }
  return cargadores;
}

// --- Reservas ---------------------------------------------------------------------------------

const TURNOS: readonly [string, string][] = [
  ['08:00', '09:30'],
  ['10:00', '11:00'],
  ['12:30', '13:30'],
  ['15:00', '16:30'],
  ['18:00', '19:00'],
  ['20:00', '21:00'],
];

/** ¿El turno cae entero dentro de alguna franja de ese día? (sin franjas = 24/7) */
export function dentroDeDisponibilidad(
  franjasCargador: Franja[],
  dia: DiaSemana,
  inicio: string,
  fin: string,
): boolean {
  if (franjasCargador.length === 0) return true;
  return franjasCargador.some((f) => f.dia === dia && f.inicio <= inicio && fin <= f.fin);
}

const solapan = (a: [string, string], b: [string, string]) => a[0] < b[1] && b[0] < a[1];

// --- Generador principal ----------------------------------------------------------------------

export function generarDatos({
  hoy,
  incluirUsuariosDemo,
  semilla = SEMILLA,
}: OpcionesGenerar): DatosSeed {
  const aleatorio = crearAleatorio(semilla);

  const modelos = CATALOGO.map((m) => ({ ...m, id: uuid(`modelo:${m.clave}`) }));
  const anfitriones = crearAnfitriones();
  const cargadores = crearCargadores(aleatorio, anfitriones);
  const demo = crearUsuariosDemo();
  const [admin, usuario] = demo as [UsuarioSeed, UsuarioSeed];

  const activos = cargadores.filter((c) => c.estado === 'activo');
  const primero = (filtro: (c: CargadorSeed) => boolean) => {
    const c = activos.find(filtro);
    if (!c) throw new Error('Seed inconsistente: falta un cargador para las reservas de demo');
    return c;
  };

  // Reservas del usuario de demostración (los tres estados de "Mis reservas"), en cargadores 24/7.
  const reservasDemo: ReservaSeed[] = [
    {
      cargador: primero(
        (c) => c.tipo === 'privado' && c.zona.grupo === 'cordoba' && c.franjas.length === 0,
      ),
      fecha: hoy,
      inicio: '18:30',
      fin: '19:30',
      estado: 'confirmada' as const,
      clave: 'confirmada',
    },
    {
      cargador: primero(
        (c) =>
          c.tipo === 'publico' && c.zona.grupo === 'corredor-carlos-paz' && c.franjas.length === 0,
      ),
      fecha: sumarDias(hoy, 1),
      inicio: '09:00',
      fin: '10:00',
      estado: 'pendiente' as const,
      clave: 'pendiente',
    },
    {
      cargador: primero(
        (c) => c.tipo === 'publico' && c.zona.grupo === 'cordoba' && c.franjas.length === 0,
      ),
      fecha: sumarDias(hoy, -3),
      inicio: '14:00',
      fin: '15:00',
      estado: 'cancelada' as const,
      clave: 'cancelada',
    },
  ].map((r) => ({
    id: uuid(`reserva:demo:${r.clave}`),
    usuarioId: usuario.id,
    cargadorId: r.cargador.id,
    fecha: r.fecha,
    horaInicio: r.inicio,
    horaFin: r.fin,
    estado: r.estado,
  }));

  // Ocupación sintética: hoy y los próximos 6 días en los cargadores activos del centro,
  // para que el motor tenga esperas y conflictos que mostrar. Se generan siempre (también en modo
  // Cognito) y evitan los turnos de las reservas de demo, así los datos no dependen del modo.
  const ocupados = reservasDemo.filter((r) => r.estado !== 'cancelada');
  const reservasSinteticas: ReservaSeed[] = [];
  const centricos = activos.filter((c) =>
    ['centro', 'nueva-cordoba', 'guemes'].includes(c.zona.clave),
  );
  for (let dia = 0; dia < 7; dia++) {
    const fecha = sumarDias(hoy, dia);
    const diaSemana = diaDeLaSemana(fecha);
    for (const cargador of centricos) {
      const cantidad = aleatorio.entero(0, 2);
      const usados = new Set<number>();
      for (let n = 0; n < cantidad; n++) {
        const t = aleatorio.entero(0, TURNOS.length - 1);
        const reservante = aleatorio.elegir(anfitriones.filter((a) => a.id !== cargador.usuarioId));
        const cancelada = aleatorio.siguiente() < 0.1;
        const turno = TURNOS[t]!;
        if (usados.has(t)) continue;
        if (!dentroDeDisponibilidad(cargador.franjas, diaSemana, turno[0], turno[1])) continue;
        const choca = ocupados.some(
          (o) =>
            o.cargadorId === cargador.id &&
            o.fecha === fecha &&
            solapan([o.horaInicio, o.horaFin], turno),
        );
        if (choca) continue;
        usados.add(t);
        reservasSinteticas.push({
          id: uuid(`reserva:${cargador.clave}:${dia}:${t}`),
          usuarioId: reservante.id,
          cargadorId: cargador.id,
          fecha,
          horaInicio: turno[0],
          horaFin: turno[1],
          estado: cancelada ? 'cancelada' : 'confirmada',
        });
      }
    }
  }

  const idModelo = (clave: string) => modelos.find((m) => m.clave === clave)!.id;
  const favoritoDemo = primero((c) => c.tipo === 'publico' && c.zona.clave === 'nueva-cordoba');

  return {
    modelos,
    usuarios: incluirUsuariosDemo ? [...anfitriones, ...demo] : anfitriones,
    cargadores,
    vehiculos: incluirUsuariosDemo
      ? [
          {
            id: uuid('vehiculo:usuario:1'),
            usuarioId: usuario.id,
            modeloId: idModelo('peugeot-e208'),
          },
          { id: uuid('vehiculo:admin:1'), usuarioId: admin.id, modeloId: idModelo('volvo-ex30') },
        ]
      : [],
    reservas: incluirUsuariosDemo ? [...reservasDemo, ...reservasSinteticas] : reservasSinteticas,
    favoritos: incluirUsuariosDemo
      ? [{ id: uuid('favorito:usuario:1'), usuarioId: usuario.id, cargadorId: favoritoDemo.id }]
      : [],
    rutas: incluirUsuariosDemo
      ? [
          {
            id: uuid('ruta:usuario:1'),
            usuarioId: usuario.id,
            nombre: 'Córdoba → Villa Carlos Paz',
            origen: ANCLAS.cordobaCentro,
            destino: ANCLAS.villaCarlosPaz,
          },
        ]
      : [],
  };
}
