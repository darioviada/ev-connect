// npm run db:seed [-- --reset | --si-vacia] — carga los datos de demostración (SINTÉTICOS).
// Idempotente; --reset vacía las tablas y vuelve a sembrar; --si-vacia solo siembra si la base no tiene
// datos (lo usa el contenedor al arrancar, para no pisar lo que se haya cargado en la demo).
import { sembrar } from '../../seeds/demo.js';
import { USUARIOS_DEMO } from '../../seeds/generar.js';
import { hoyEnZona } from '../../seeds/fechas.js';
import { cargarConfigBase, ConfigError } from '../config/index.js';
import { crearKnex } from './knex.js';

async function main() {
  const reset = process.argv.includes('--reset');
  const config = cargarConfigBase();
  const db = crearKnex(config.databaseUrl, config.tz);
  try {
    if (process.argv.includes('--si-vacia')) {
      const fila = await db('vehiculo_modelo').count<{ n: string }[]>({ n: '*' });
      if (Number(fila[0]?.n ?? 0) > 0) {
        console.log(
          'La base ya tiene datos: no se vuelve a sembrar (usá --reset para empezar de cero).',
        );
        return;
      }
    }
    const hoy = hoyEnZona(config.tz);
    const r = await sembrar(db, { reset, modoAuth: config.authMode, hoy });
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
