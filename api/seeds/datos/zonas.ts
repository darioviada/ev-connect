// DATOS SINTÉTICOS DE DEMOSTRACIÓN — zonas donde se ubican los cargadores de ejemplo.
// Coordenadas ancla APROXIMADAS (verificar). La mayoría está en Córdoba capital (zona piloto), algunas sobre los
// corredores Córdoba–Villa Carlos Paz y Córdoba–Alta Gracia (para el modo ruta) y unas pocas en otras ciudades
// del país, porque el sistema tiene alcance nacional (docs/DECISIONES.md, D-001).

export interface ZonaSeed {
  clave: string;
  nombre: string;
  ciudad: string;
  lat: number;
  lng: number;
  /** Dispersión máxima alrededor del ancla, en grados (~0.004° ≈ 450 m). */
  dispersion: number;
  publicos: number;
  privados: number;
  grupo: 'cordoba' | 'corredor-carlos-paz' | 'corredor-alta-gracia' | 'otras-ciudades';
}

const ciudad = (
  clave: string,
  nombre: string,
  lat: number,
  lng: number,
  publicos: number,
  privados: number,
): ZonaSeed => ({
  clave,
  nombre,
  ciudad: 'Córdoba',
  lat,
  lng,
  dispersion: 0.004,
  publicos,
  privados,
  grupo: 'cordoba',
});

export const ANCLAS = {
  cordobaCentro: { lat: -31.4201, lng: -64.1888 },
  villaCarlosPaz: { lat: -31.4241, lng: -64.4978 },
  altaGracia: { lat: -31.654, lng: -64.4284 },
} as const;

export const ZONAS: readonly ZonaSeed[] = [
  // Córdoba capital: 13 públicos + 32 privados
  ciudad('centro', 'Centro', -31.4167, -64.1833, 3, 3),
  ciudad('nueva-cordoba', 'Nueva Córdoba', -31.4268, -64.1859, 2, 4),
  ciudad('guemes', 'Güemes', -31.4248, -64.195, 1, 2),
  ciudad('general-paz', 'General Paz', -31.412, -64.165, 1, 3),
  ciudad('alta-cordoba', 'Alta Córdoba', -31.395, -64.178, 1, 2),
  ciudad('alberdi', 'Alberdi', -31.41, -64.205, 0, 2),
  ciudad('cerro-de-las-rosas', 'Cerro de las Rosas', -31.372, -64.231, 1, 4),
  ciudad('villa-belgrano', 'Villa Belgrano', -31.355, -64.255, 1, 3),
  ciudad('arguello', 'Argüello', -31.348, -64.265, 1, 2),
  ciudad('urca', 'Urca', -31.38, -64.21, 0, 2),
  ciudad('jardin', 'Jardín', -31.45, -64.177, 1, 2),
  ciudad('ciudad-universitaria', 'Ciudad Universitaria', -31.438, -64.192, 1, 0),
  ciudad('san-vicente', 'San Vicente', -31.423, -64.155, 0, 1),
  ciudad('villa-cabrera', 'Villa Cabrera', -31.383, -64.2, 0, 2),

  // Corredor Córdoba – Villa Carlos Paz: 3 públicos + 3 privados
  {
    clave: 'autopista-vcp-km10',
    nombre: 'Autopista a Carlos Paz, km 10',
    ciudad: 'Córdoba',
    lat: -31.428,
    lng: -64.29,
    dispersion: 0.001,
    publicos: 1,
    privados: 0,
    grupo: 'corredor-carlos-paz',
  },
  {
    clave: 'malagueno',
    nombre: 'Acceso Malagueño',
    ciudad: 'Malagueño',
    lat: -31.44,
    lng: -64.36,
    dispersion: 0.002,
    publicos: 1,
    privados: 1,
    grupo: 'corredor-carlos-paz',
  },
  {
    clave: 'villa-carlos-paz',
    nombre: 'Centro',
    ciudad: 'Villa Carlos Paz',
    lat: ANCLAS.villaCarlosPaz.lat,
    lng: ANCLAS.villaCarlosPaz.lng,
    dispersion: 0.004,
    publicos: 1,
    privados: 2,
    grupo: 'corredor-carlos-paz',
  },

  // Corredor Córdoba – Alta Gracia: 2 públicos + 3 privados
  {
    clave: 'rp5-km15',
    nombre: 'Ruta 5, km 15',
    ciudad: 'Córdoba',
    lat: -31.497,
    lng: -64.268,
    dispersion: 0.001,
    publicos: 0,
    privados: 1,
    grupo: 'corredor-alta-gracia',
  },
  {
    clave: 'rp5-km25',
    nombre: 'Ruta 5, km 25',
    ciudad: 'Córdoba',
    lat: -31.574,
    lng: -64.347,
    dispersion: 0.001,
    publicos: 1,
    privados: 0,
    grupo: 'corredor-alta-gracia',
  },
  {
    clave: 'alta-gracia',
    nombre: 'Centro',
    ciudad: 'Alta Gracia',
    lat: ANCLAS.altaGracia.lat,
    lng: ANCLAS.altaGracia.lng,
    dispersion: 0.004,
    publicos: 1,
    privados: 2,
    grupo: 'corredor-alta-gracia',
  },

  // Otras ciudades (alcance nacional): 2 públicos + 2 privados
  {
    clave: 'rosario-centro',
    nombre: 'Centro',
    ciudad: 'Rosario',
    lat: -32.9468,
    lng: -60.6393,
    dispersion: 0.004,
    publicos: 1,
    privados: 1,
    grupo: 'otras-ciudades',
  },
  {
    clave: 'caba-palermo',
    nombre: 'Palermo',
    ciudad: 'Ciudad Autónoma de Buenos Aires',
    lat: -34.5889,
    lng: -58.4306,
    dispersion: 0.004,
    publicos: 1,
    privados: 1,
    grupo: 'otras-ciudades',
  },
];
