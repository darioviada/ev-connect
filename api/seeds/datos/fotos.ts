// Fotos del catálogo (D-047): Wikimedia Commons, licencia CC BY-SA 4.0, redimensionadas a 800 px de ancho
// (miniatura oficial de Commons). Licencias verificadas el 2026-11-06 en la página de cada archivo.
// Algunos modelos se venden en Europa con otro nombre: la foto es del gemelo europeo y el crédito lo aclara.
// El "Urbano T2 (ficticio)" no tiene foto: la interfaz muestra un dibujo genérico.

export interface FotoSeed {
  /** Archivo en seeds/datos/fotos/ */
  archivo: string;
  credito: string;
  fuenteUrl: string;
}

const commons = (autor: string, nota = '') =>
  `Foto: ${autor} · CC BY-SA 4.0 · Wikimedia Commons${nota ? ` (${nota})` : ''}`;

export const FOTOS: Readonly<Record<string, FotoSeed>> = {
  'peugeot-e208': {
    archivo: 'peugeot-e208.jpg',
    credito: commons('Alexander Migl'),
    fuenteUrl:
      'https://commons.wikimedia.org/wiki/File:Peugeot_e-208_Allure_Genf_2019_1Y7A5132.jpg',
  },
  'byd-dolphin-mini': {
    archivo: 'byd-dolphin-mini.jpg',
    credito: commons('Alexander-93', 'BYD Dolphin Surf, nombre europeo del Dolphin Mini'),
    fuenteUrl: 'https://commons.wikimedia.org/wiki/File:BYD_Dolphin_Surf_IMG_3808.jpg',
  },
  'renault-kwid-etech': {
    archivo: 'renault-kwid-etech.jpg',
    credito: commons('Alexander Migl', 'Dacia Spring, gemelo europeo del Kwid E-Tech'),
    fuenteUrl: 'https://commons.wikimedia.org/wiki/File:Dacia_Spring_1X7A0346.jpg',
  },
  'nissan-leaf': {
    archivo: 'nissan-leaf.jpg',
    credito: commons('Vauxford'),
    fuenteUrl: 'https://commons.wikimedia.org/wiki/File:2018_Nissan_Leaf_Tekna_Front.jpg',
  },
  'volvo-ex30': {
    archivo: 'volvo-ex30.jpg',
    credito: commons('Alexander-93'),
    fuenteUrl: 'https://commons.wikimedia.org/wiki/File:Volvo_EX30_1X7A1950.jpg',
  },
  'byd-yuan-plus': {
    archivo: 'byd-yuan-plus.jpg',
    credito: commons('Alexander Migl', 'BYD Atto 3, nombre europeo del Yuan Plus'),
    fuenteUrl: 'https://commons.wikimedia.org/wiki/File:BYD_Atto_3_1X7A6494.jpg',
  },
  'byd-seal': {
    archivo: 'byd-seal.jpg',
    credito: commons('Alexander-93'),
    fuenteUrl: 'https://commons.wikimedia.org/wiki/File:BYD_Seal_IAA_2023_1X7A0371.jpg',
  },
};
