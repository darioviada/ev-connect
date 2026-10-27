// DATOS SINTÉTICOS DE DEMOSTRACIÓN — catálogo de modelos de vehículos.
// Todos los valores son APROXIMADOS (capacidad útil, consumo mixto, potencias máximas): el autor debe
// verificarlos con la ficha oficial de cada fabricante antes de citarlos en el informe.
// El modelo "ficticio" existe solo para ejercitar el filtro de compatibilidad (vehículo solo TIPO_2, sin DC).

export type TipoConector = 'TIPO_2' | 'CCS_COMBO' | 'CHADEMO';

export interface ModeloSeed {
  clave: string;
  marca: string;
  modelo: string;
  /** kWh */
  capacidadBateria: number;
  /** kWh/100 km */
  consumo: number;
  tipoConector: TipoConector;
  /** kW */
  potenciaMaxAc: number;
  /** kW; null = sin carga en corriente continua */
  potenciaMaxDc: number | null;
}

export const CATALOGO: readonly ModeloSeed[] = [
  // aproximado: verificar con ficha oficial
  {
    clave: 'peugeot-e208',
    marca: 'Peugeot',
    modelo: 'e-208',
    capacidadBateria: 50,
    consumo: 15.6,
    tipoConector: 'CCS_COMBO',
    potenciaMaxAc: 7.4,
    potenciaMaxDc: 100,
  },
  // aproximado: verificar con ficha oficial
  {
    clave: 'byd-dolphin-mini',
    marca: 'BYD',
    modelo: 'Dolphin Mini',
    capacidadBateria: 38,
    consumo: 12.9,
    tipoConector: 'CCS_COMBO',
    potenciaMaxAc: 6.6,
    potenciaMaxDc: 40,
  },
  // aproximado: verificar con ficha oficial
  {
    clave: 'renault-kwid-etech',
    marca: 'Renault',
    modelo: 'Kwid E-Tech',
    capacidadBateria: 26.8,
    consumo: 12.5,
    tipoConector: 'CCS_COMBO',
    potenciaMaxAc: 7,
    potenciaMaxDc: 30,
  },
  // aproximado: verificar con ficha oficial
  {
    clave: 'nissan-leaf',
    marca: 'Nissan',
    modelo: 'Leaf',
    capacidadBateria: 40,
    consumo: 17,
    tipoConector: 'CHADEMO',
    potenciaMaxAc: 6.6,
    potenciaMaxDc: 50,
  },
  // aproximado: verificar con ficha oficial
  {
    clave: 'volvo-ex30',
    marca: 'Volvo',
    modelo: 'EX30',
    capacidadBateria: 64,
    consumo: 16.7,
    tipoConector: 'CCS_COMBO',
    potenciaMaxAc: 11,
    potenciaMaxDc: 150,
  },
  // aproximado: verificar con ficha oficial
  {
    clave: 'byd-yuan-plus',
    marca: 'BYD',
    modelo: 'Yuan Plus',
    capacidadBateria: 60.5,
    consumo: 15.8,
    tipoConector: 'CCS_COMBO',
    potenciaMaxAc: 7,
    potenciaMaxDc: 80,
  },
  // aproximado: verificar con ficha oficial
  {
    clave: 'byd-seal',
    marca: 'BYD',
    modelo: 'Seal',
    capacidadBateria: 82.5,
    consumo: 17,
    tipoConector: 'CCS_COMBO',
    potenciaMaxAc: 11,
    potenciaMaxDc: 150,
  },
  // FICTICIO (rotulado): solo TIPO_2 y sin carga DC, para probar el filtro de compatibilidad
  {
    clave: 'ficticio-urbano-t2',
    marca: 'Modelo ficticio',
    modelo: 'Urbano T2 (ficticio)',
    capacidadBateria: 30,
    consumo: 14,
    tipoConector: 'TIPO_2',
    potenciaMaxAc: 11,
    potenciaMaxDc: null,
  },
];
