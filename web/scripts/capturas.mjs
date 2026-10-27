// npm run capturas -w web — recorre el guion de demo en Chromium (Playwright) y guarda una captura de
// cada pantalla en docs/capturas/. Requiere la base sembrada y `npm run dev` corriendo (web en :5173).
// No escribe datos: solo navega, busca y abre pantallas.
// Protección de costo: si el .env tiene GOOGLE_MAPS_API_KEY (y el proveedor no es offline), cada búsqueda
// consulta la Routes API de Google. En ese caso el script no corre salvo CAPTURAS_PERMITIR_GOOGLE=1.
import { existsSync, readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.env.CAPTURAS_URL ?? 'http://localhost:5173';
const SALIDA = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../docs/capturas');
const MOVIL = { width: 390, height: 844 };
const ESCRITORIO = { width: 1440, height: 900 };

const archivoEnv = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../.env');
if (existsSync(archivoEnv)) {
  const env = Object.fromEntries(
    readFileSync(archivoEnv, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2]]),
  );
  const usaGoogle = Boolean(env.GOOGLE_MAPS_API_KEY) && env.ROUTING_PROVIDER !== 'offline';
  if (usaGoogle && process.env.CAPTURAS_PERMITIR_GOOGLE !== '1') {
    console.error(
      'El .env tiene una clave de Google: las búsquedas del recorrido consultarían la Routes API (con costo).\n' +
        'Usá ROUTING_PROVIDER=offline para las capturas, o CAPTURAS_PERMITIR_GOOGLE=1 si querés usar Google.',
    );
    process.exit(1);
  }
}

await mkdir(SALIDA, { recursive: true });
const navegador = await chromium.launch();
const contexto = await navegador.newContext({
  viewport: MOVIL,
  deviceScaleFactor: 2,
  locale: 'es-AR',
});
const pagina = await contexto.newPage();
pagina.on('pageerror', (e) => console.error('Error en la página:', e.message));

async function captura(nombre, opciones = {}) {
  await pagina.waitForLoadState('networkidle').catch(() => undefined);
  if (opciones.completa ?? true) {
    // En una captura de página completa, los elementos fijos (navegación inferior, aviso) se verían en el
    // medio: se los ubica al final del contenido solo para la foto.
    await pagina.addStyleTag({
      content: 'nav[aria-label="Principal"], p[role="note"] { position: static !important; }',
    });
  }
  await pagina.screenshot({
    path: path.join(SALIDA, `${nombre}.png`),
    fullPage: opciones.completa ?? true,
  });
  console.log(`  ✓ ${nombre}.png`);
}

async function buscarUbicacion(etiqueta, texto, resultado) {
  await pagina.getByLabel(etiqueta, { exact: true }).fill(texto);
  await pagina.getByLabel(etiqueta, { exact: true }).press('Enter');
  await pagina
    .getByRole('button', { name: new RegExp(resultado) })
    .first()
    .click();
}

console.log(`Capturas en ${SALIDA}`);

// 1. Bienvenida y login (invitado)
await pagina.goto(`${BASE}/inicio`);
await captura('01-inicio');
await pagina.goto(`${BASE}/login`);
await captura('02-login');

// 2. Búsqueda como invitado: e-208, Nueva Córdoba, 45 %
await pagina.goto(`${BASE}/inicio`);
await pagina.getByRole('button', { name: 'Continuar como invitado' }).click();
await pagina.getByLabel('Tu vehículo', { exact: true }).selectOption({ label: 'Peugeot e-208' });
await buscarUbicacion('Ubicación', 'nueva cordoba', 'Nueva Córdoba');
await captura('03-home-buscador');

await pagina.getByRole('button', { name: 'Buscar cargadores' }).click();
await pagina.getByRole('list', { name: 'Cargadores recomendados' }).waitFor();
await captura('04-resultados');

await pagina.getByRole('button', { name: 'Ver en el mapa' }).click();
await pagina
  .locator('.leaflet-tile-loaded')
  .first()
  .waitFor({ timeout: 15_000 })
  .catch(() => undefined);
await captura('05-resultados-mapa', { completa: false });

await pagina.getByRole('button', { name: 'Ver como lista' }).click();
await pagina
  .getByRole('list', { name: 'Cargadores recomendados' })
  .getByRole('link')
  .first()
  .click();
await pagina.getByText('¿Por qué lo recomendamos?').waitFor();
await captura('06-detalle-y-reserva');

// 3. Con sesión (usuario de demostración)
await pagina.goto(`${BASE}/login`);
await pagina.getByLabel('Correo electrónico').fill('usuario@demo.local');
await pagina.getByLabel('Contraseña').fill('Usuario123!');
await pagina.getByRole('button', { name: 'Continuar' }).click();
await pagina.getByRole('heading', { name: '¿Dónde cargamos tu vehículo?' }).waitFor();
await captura('07-home-con-sesion');

await pagina.goto(`${BASE}/vehiculos`);
await captura('08-mis-vehiculos');
await pagina.getByRole('link').filter({ hasText: 'e-208' }).first().click();
await captura('09-detalle-vehiculo');
await pagina.goto(`${BASE}/vehiculos/nuevo`);
await captura('10-agregar-vehiculo');
await pagina.goto(`${BASE}/reservas`);
await captura('11-mis-reservas');
await pagina.goto(`${BASE}/publicar`);
await captura('12-publicar-cargador');
await pagina.goto(`${BASE}/favoritos`);
await captura('13-favoritos');
await pagina.getByRole('tab', { name: 'Rutas guardadas' }).click();
await captura('14-rutas-guardadas');

// 4. Modo ruta: Córdoba → Villa Carlos Paz
await pagina.goto(`${BASE}/`);
await pagina.getByRole('button', { name: 'Ruta', exact: true }).click();
await buscarUbicacion('Origen', 'cordoba centro', 'Córdoba Centro');
await buscarUbicacion('Destino', 'carlos paz', 'Villa Carlos Paz');
await pagina.getByRole('button', { name: 'Buscar cargadores' }).click();
await pagina.getByRole('list', { name: 'Cargadores recomendados' }).waitFor();
await captura('15-resultados-ruta');
await pagina.getByRole('button', { name: 'Ver en el mapa' }).click();
await pagina
  .locator('.leaflet-tile-loaded')
  .first()
  .waitFor({ timeout: 15_000 })
  .catch(() => undefined);
await captura('16-ruta-mapa', { completa: false });

// 5. Escritorio
await pagina.setViewportSize(ESCRITORIO);
await pagina.goto(`${BASE}/`);
await pagina.getByRole('heading', { name: '¿Dónde cargamos tu vehículo?' }).waitFor();
await captura('17-home-escritorio', { completa: false });

// 6. Administración
await pagina.goto(`${BASE}/login`);
await pagina.evaluate(() => localStorage.clear());
await pagina.goto(`${BASE}/login`);
await pagina.getByLabel('Correo electrónico').fill('admin@demo.local');
await pagina.getByLabel('Contraseña').fill('Admin123!');
await pagina.getByRole('button', { name: 'Continuar' }).click();
await pagina.getByRole('heading', { name: '¿Dónde cargamos tu vehículo?' }).waitFor();
await pagina.goto(`${BASE}/admin`);
await pagina.getByRole('table').waitFor();
await captura('18-admin', { completa: false });

await navegador.close();
console.log('Listo.');
