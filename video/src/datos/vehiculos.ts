// Datos fijos del video (Juan y su BYD Dolphin Mini). Especificaciones del catálogo sintético de la demo
// (api/seeds/datos/catalogo.ts, valores aproximados); fotos de Wikimedia Commons (CC BY-SA 4.0).
import { staticFile } from 'remotion';
import type { ModeloVehiculo } from '../../../web/src/api/tipos';

const commons = (autor: string, nota = '') =>
  `Foto: ${autor} · CC BY-SA 4.0 · Wikimedia Commons${nota ? ` (${nota})` : ''}`;

const sinFoto = { fotoUrl: null, fotoCredito: null, fotoFuenteUrl: null };

export const DOLPHIN_MINI: ModeloVehiculo = {
  id: 'dolphin-mini',
  marca: 'BYD',
  modelo: 'Dolphin Mini',
  capacidadBateriaKwh: 38,
  consumoKwhPor100km: 12.9,
  tipoConector: 'CCS_COMBO',
  potenciaMaxAcKw: 6.6,
  potenciaMaxDcKw: 40,
  fotoUrl: staticFile('fotos/byd-dolphin-mini.jpg'),
  fotoCredito: commons('Alexander-93', 'BYD Dolphin Surf, nombre europeo del Dolphin Mini'),
  fotoFuenteUrl: null,
};

export const E208: ModeloVehiculo = {
  id: 'e208',
  marca: 'Peugeot',
  modelo: 'e-208',
  capacidadBateriaKwh: 50,
  consumoKwhPor100km: 15.6,
  tipoConector: 'CCS_COMBO',
  potenciaMaxAcKw: 7.4,
  potenciaMaxDcKw: 100,
  fotoUrl: staticFile('fotos/peugeot-e208.jpg'),
  fotoCredito: commons('Alexander Migl'),
  fotoFuenteUrl: null,
};

/** Catálogo en el orden en que lo muestra la app (marca y modelo). */
export const CATALOGO: readonly ModeloVehiculo[] = [
  DOLPHIN_MINI,
  {
    ...sinFoto,
    id: 'seal',
    marca: 'BYD',
    modelo: 'Seal',
    capacidadBateriaKwh: 82.5,
    consumoKwhPor100km: 17,
    tipoConector: 'CCS_COMBO',
    potenciaMaxAcKw: 11,
    potenciaMaxDcKw: 150,
  },
  {
    ...sinFoto,
    id: 'yuan',
    marca: 'BYD',
    modelo: 'Yuan Plus',
    capacidadBateriaKwh: 60.5,
    consumoKwhPor100km: 15.8,
    tipoConector: 'CCS_COMBO',
    potenciaMaxAcKw: 7,
    potenciaMaxDcKw: 80,
  },
  {
    ...sinFoto,
    id: 'ficticio',
    marca: 'Modelo ficticio',
    modelo: 'Urbano T2 (ficticio)',
    capacidadBateriaKwh: 30,
    consumoKwhPor100km: 14,
    tipoConector: 'TIPO_2',
    potenciaMaxAcKw: 11,
    potenciaMaxDcKw: null,
  },
  {
    ...sinFoto,
    id: 'leaf',
    marca: 'Nissan',
    modelo: 'Leaf',
    capacidadBateriaKwh: 40,
    consumoKwhPor100km: 17,
    tipoConector: 'CHADEMO',
    potenciaMaxAcKw: 6.6,
    potenciaMaxDcKw: 50,
  },
  E208,
  {
    ...sinFoto,
    id: 'kwid',
    marca: 'Renault',
    modelo: 'Kwid E-Tech',
    capacidadBateriaKwh: 26.8,
    consumoKwhPor100km: 12.5,
    tipoConector: 'CCS_COMBO',
    potenciaMaxAcKw: 7,
    potenciaMaxDcKw: 30,
  },
  {
    ...sinFoto,
    id: 'ex30',
    marca: 'Volvo',
    modelo: 'EX30',
    capacidadBateriaKwh: 64,
    consumoKwhPor100km: 16.7,
    tipoConector: 'CCS_COMBO',
    potenciaMaxAcKw: 11,
    potenciaMaxDcKw: 150,
  },
];

/** Usuario del caso de uso del guion. */
export const JUAN = { nombre: 'Juan Pérez', email: 'juan.perez@correo.com' } as const;
