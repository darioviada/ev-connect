// Generación reproducible de escenarios de validación (SPEC §12.1): vehículo del catálogo, batería 0–100,
// origen en Córdoba capital, día y hora dentro de una semana fija, y una parte en modo ruta.
import { crearAleatorio } from '../../seeds/aleatorio.js';
import { minutosLocales } from '../engine/tiempo.js';
import type { LatLng, Modo, VehiculoMotor } from '../engine/tipos.js';

/** Semana de referencia (lunes): el seed de la base de validación se genera con esta fecha. */
export const FECHA_BASE = '2026-11-02';

/** Zona de origen: Córdoba capital (rectángulo aproximado). */
export const ZONA_ORIGEN = { latMin: -31.46, latMax: -31.34, lngMin: -64.28, lngMax: -64.12 };

/** Destinos del modo ruta: los corredores del seed. */
export const DESTINOS_RUTA: readonly { nombre: string; punto: LatLng }[] = [
  { nombre: 'Villa Carlos Paz', punto: { lat: -31.4241, lng: -64.4978 } },
  { nombre: 'Alta Gracia', punto: { lat: -31.654, lng: -64.4284 } },
];

export interface ModeloCatalogo {
  id: string;
  descripcion: string;
  vehiculo: VehiculoMotor;
}

export interface Escenario {
  id: number;
  modelo: ModeloCatalogo;
  bateriaPct: number;
  modo: Modo;
  origen: LatLng;
  destino?: LatLng;
  destinoNombre?: string;
  fecha: string;
  hora: string;
  /** Instante equivalente a fecha + hora en Argentina (UTC−3, sin horario de verano). */
  ahora: Date;
}

const r5 = (x: number) => Math.round(x * 1e5) / 1e5;
const dos = (n: number) => String(n).padStart(2, '0');

function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

export function generarEscenarios(opciones: {
  semilla: number;
  cantidad: number;
  catalogo: readonly ModeloCatalogo[];
  proporcionRuta: number;
}): Escenario[] {
  if (opciones.catalogo.length === 0) throw new Error('El catálogo está vacío: corré el seed.');
  const azar = crearAleatorio(opciones.semilla);
  const escenarios: Escenario[] = [];
  for (let id = 1; id <= opciones.cantidad; id++) {
    // El orden de las llamadas al generador es fijo: misma semilla → mismos escenarios.
    const modelo = azar.elegir(opciones.catalogo);
    const bateriaPct = azar.entero(0, 100);
    const enRuta = azar.siguiente() < opciones.proporcionRuta;
    const origen = {
      lat: r5(azar.entre(ZONA_ORIGEN.latMin, ZONA_ORIGEN.latMax)),
      lng: r5(azar.entre(ZONA_ORIGEN.lngMin, ZONA_ORIGEN.lngMax)),
    };
    const destino = azar.elegir(DESTINOS_RUTA);
    const fecha = sumarDias(FECHA_BASE, azar.entero(0, 6));
    const minuto = azar.entero(0, 24 * 60 - 1);
    const hora = `${dos(Math.floor(minuto / 60))}:${dos(minuto % 60)}`;
    escenarios.push({
      id,
      modelo,
      bateriaPct,
      modo: enRuta ? 'ruta' : 'ubicacion',
      origen,
      ...(enRuta ? { destino: destino.punto, destinoNombre: destino.nombre } : {}),
      fecha,
      hora,
      ahora: new Date((minutosLocales(fecha, hora) + 3 * 60) * 60_000),
    });
  }
  return escenarios;
}
