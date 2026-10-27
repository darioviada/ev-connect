// Lista fija para GEOCODING_PROVIDER=static (sin servicios externos).
// Coordenadas APROXIMADAS del centro de cada lugar (verificar). Alcance nacional (docs/DECISIONES.md, D-001):
// barrios de Córdoba (zona piloto del seed), localidades de los corredores de prueba y ciudades del país.
import type { Lugar } from './tipos.js';

const cba = (nombre: string, lat: number, lng: number): Lugar => ({
  nombre,
  descripcion: `${nombre}, Córdoba`,
  lat,
  lng,
});
const ciudad = (nombre: string, provincia: string, lat: number, lng: number): Lugar => ({
  nombre,
  descripcion: `${nombre}, ${provincia}`,
  lat,
  lng,
});

export const LUGARES: readonly Lugar[] = [
  // Córdoba capital (barrios)
  cba('Córdoba Centro', -31.4201, -64.1888),
  cba('Nueva Córdoba', -31.4268, -64.1859),
  cba('Güemes', -31.4248, -64.195),
  cba('General Paz', -31.412, -64.165),
  cba('Alta Córdoba', -31.395, -64.178),
  cba('Alberdi', -31.41, -64.205),
  cba('Cerro de las Rosas', -31.372, -64.231),
  cba('Villa Belgrano', -31.355, -64.255),
  cba('Argüello', -31.348, -64.265),
  cba('Jardín', -31.45, -64.177),
  cba('Ciudad Universitaria', -31.438, -64.192),
  // Provincia de Córdoba
  ciudad('Villa Carlos Paz', 'Córdoba', -31.4241, -64.4978),
  ciudad('Alta Gracia', 'Córdoba', -31.654, -64.4284),
  ciudad('Malagueño', 'Córdoba', -31.464, -64.358),
  ciudad('Río Cuarto', 'Córdoba', -33.1232, -64.3493),
  ciudad('Villa María', 'Córdoba', -32.4075, -63.2402),
  ciudad('Jesús María', 'Córdoba', -30.9815, -64.0942),
  // Otras ciudades del país
  ciudad('Ciudad Autónoma de Buenos Aires', 'Buenos Aires', -34.6037, -58.3816),
  ciudad('La Plata', 'Buenos Aires', -34.9205, -57.9536),
  ciudad('Mar del Plata', 'Buenos Aires', -38.0055, -57.5426),
  ciudad('Bahía Blanca', 'Buenos Aires', -38.7183, -62.2663),
  ciudad('Rosario', 'Santa Fe', -32.9468, -60.6393),
  ciudad('Santa Fe', 'Santa Fe', -31.6333, -60.7),
  ciudad('Paraná', 'Entre Ríos', -31.7319, -60.5238),
  ciudad('Mendoza', 'Mendoza', -32.8895, -68.8458),
  ciudad('San Juan', 'San Juan', -31.5375, -68.5364),
  ciudad('San Miguel de Tucumán', 'Tucumán', -26.8083, -65.2176),
  ciudad('Salta', 'Salta', -24.7821, -65.4232),
  ciudad('Neuquén', 'Neuquén', -38.9516, -68.0591),
  ciudad('San Carlos de Bariloche', 'Río Negro', -41.1335, -71.3103),
  ciudad('Corrientes', 'Corrientes', -27.4692, -58.8306),
  ciudad('Posadas', 'Misiones', -27.3671, -55.8961),
];
