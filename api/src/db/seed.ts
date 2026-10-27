// npm run db:seed [-- --reset] — carga los datos de demostración (SINTÉTICOS).
// Idempotente; --reset vacía las tablas y vuelve a sembrar.
import { sembrar } from '../../seeds/demo.js';
import { USUARIOS_DEMO } from '../../seeds/generar.js';
import { hoyEnZona } from '../../seeds/fechas.js';
import { cargarConfig, ConfigError } from '../config/index.js';
import { crearKnex } from './knex.js';

async function main() {
  const reset = process.argv.includes('--reset');
  const config = cargarConfig();
  const db = crearKnex(config.databaseUrl, config.tz);
  try {
    const hoy = hoyEnZona(config.tz);
    const r = await sembrar(db, { reset, modoAuth: config.auth.mode, hoy });
    console.log(`Datos de demostración (sintéticos) cargados${reset ? ' desde cero' : ''}:`);
    console.log(`  - ${r.modelos} modelos de vehículo (especificaciones aproximadas)`);
    console.log(
      `  - ${r.cargadores.publicos + r.cargadores.privados} cargadores ` +
        `(${r.cargadores.publicos} públicos, ${r.cargadores.privados} privados, ${r.cargadores.inactivos} inactivos), ` +
        `${r.franjas} franjas de disponibilidad`,
    );
    console.log(`  - ${r.usuarios} usuarios, ${r.reservas} reservas (fechas relativas a ${hoy})`);
    if (r.usuariosDemo) {
      console.log('Usuarios de demostración (modo local):');
      for (const u of Object.values(USUARIOS_DEMO)) {
        console.log(`  - ${u.email} / ${u.password} (${u.rol})`);
      }
    } else {
      console.log('AUTH_MODE=cognito: no se crean usuarios de demostración con contraseña.');
    }
  } finally {
    await db.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof ConfigError ? error.message : error);
  process.exit(1);
});
