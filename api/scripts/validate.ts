// npm run validate [-- --scenarios 200 --seed 42 --proporcion-ruta 0.2 --proveedor offline]
// Valida el motor contra la "selección manual simulada" (SPEC §12) y escribe docs/validacion/resultados.{csv,md}.
// Usa su propia base (`<base>_validacion`) sembrada con una fecha fija: el resultado es reproducible y no
// toca la base de desarrollo. Por defecto usa el proveedor OFFLINE aunque haya clave de Google (D-035).
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { sembrar } from '../seeds/demo.js';
import { cargarConfig, ConfigError } from '../src/config/index.js';
import { asegurarBaseDeDatos, urlConSufijo } from '../src/db/crearBase.js';
import { crearKnex } from '../src/db/knex.js';
import { migrarTodo } from '../src/db/migraciones.js';
import {
  CacheRutasPg,
  CacheTrazadosPg,
  GoogleRoutesProvider,
  OfflineProvider,
  type RoutingProvider,
} from '../src/routing/index.js';
import { resumir } from '../src/validacion/analisis.js';
import { ejecutarValidacion } from '../src/validacion/ejecutar.js';
import { FECHA_BASE } from '../src/validacion/escenarios.js';
import { cargarCatalogo } from '../src/validacion/ejecutar.js';
import {
  ejecutarViajes,
  generarViajes,
  resumirViajes,
  viajesACsv,
} from '../src/validacion/viajes.js';
import { aCsv, aMarkdown } from '../src/validacion/informe.js';

const SALIDA = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../docs/validacion');

async function main() {
  const { values } = parseArgs({
    options: {
      scenarios: { type: 'string', default: '200' },
      seed: { type: 'string', default: '42' },
      'proporcion-ruta': { type: 'string', default: '0.2' },
      viajes: { type: 'string', default: '60' },
      proveedor: { type: 'string', default: 'offline' },
      'confirmar-costo': { type: 'boolean', default: false },
    },
  });
  const cantidad = Number(values.scenarios);
  const semilla = Number(values.seed);
  const proporcionRuta = Number(values['proporcion-ruta']);
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 5000)
    throw new Error('--scenarios debe ser un entero entre 1 y 5000');
  if (!Number.isInteger(semilla)) throw new Error('--seed debe ser un entero');
  if (!(proporcionRuta >= 0 && proporcionRuta <= 1))
    throw new Error('--proporcion-ruta debe estar entre 0 y 1');
  const cantidadViajes = Number(values.viajes);
  if (!Number.isInteger(cantidadViajes) || cantidadViajes < 0 || cantidadViajes > 1000)
    throw new Error('--viajes debe ser un entero entre 0 y 1000');

  const config = cargarConfig();
  const url =
    process.env.VALIDATION_DATABASE_URL ?? urlConSufijo(config.databaseUrl, '_validacion');
  await asegurarBaseDeDatos(url);
  const db = crearKnex(url, config.tz);

  try {
    console.log(
      `Base de validación: ${new URL(url).pathname.slice(1)} (seed sintético con fecha ${FECHA_BASE})`,
    );
    await migrarTodo(db, 'local');
    await sembrar(db, { reset: true, modoAuth: 'local', hoy: FECHA_BASE });

    let rutas: RoutingProvider = new OfflineProvider();
    if (values.proveedor === 'google') {
      const clave =
        config.routing.provider === 'google'
          ? config.routing.googleApiKey
          : process.env.GOOGLE_MAPS_API_KEY;
      if (!clave) throw new Error('--proveedor google requiere GOOGLE_MAPS_API_KEY en el .env');
      if (!values['confirmar-costo']) {
        throw new Error(
          `Con Google cada escenario consulta la Routes API (aprox. ${cantidad} × 60 elementos sin caché, con costo). ` +
            'Si estás de acuerdo, agregá --confirmar-costo.',
        );
      }
      rutas = new GoogleRoutesProvider({
        apiKey: clave,
        cache: new CacheRutasPg(db),
        cacheTrazados: new CacheTrazadosPg(db),
      });
    } else if (values.proveedor !== 'offline') {
      throw new Error('--proveedor debe ser offline o google');
    }

    console.log(
      `Escenarios: ${cantidad} · semilla: ${semilla} · modo ruta: ${proporcionRuta * 100} % · proveedor: ${rutas.nombre}`,
    );
    const inicio = performance.now();
    const r = await ejecutarValidacion({
      db,
      rutas,
      engine: config.engine,
      zonaHoraria: config.tz,
      semilla,
      cantidad,
      proporcionRuta,
      alProgresar: (hechos, total) => {
        if (hechos % 50 === 0 || hechos === total) console.log(`  ${hechos}/${total}`);
      },
    });

    // Viajes largos con paradas (D-045)
    const viajes =
      cantidadViajes > 0
        ? await ejecutarViajes(
            { db, rutas, engine: config.engine },
            config.tz,
            generarViajes({
              semilla,
              cantidad: cantidadViajes,
              catalogo: await cargarCatalogo(db),
            }),
          )
        : [];

    await mkdir(SALIDA, { recursive: true });
    await writeFile(path.join(SALIDA, 'resultados.csv'), aCsv(r.filas), 'utf8');
    if (viajes.length > 0) {
      await writeFile(path.join(SALIDA, 'resultados-viajes.csv'), viajesACsv(viajes), 'utf8');
    }
    await writeFile(
      path.join(SALIDA, 'resultados.md'),
      aMarkdown(r.filas, {
        cantidad,
        semilla,
        proporcionRuta,
        proveedor: rutas.nombre,
        fechaBase: FECHA_BASE,
        cargadoresActivos: r.cargadoresActivos,
        candidatosLimite: config.engine.candidatesLimit,
        radioKm: config.engine.searchRadiusKm,
        corredorKm: config.engine.corridorKm,
        elementosConsultados: r.elementosConsultados,
        viajes,
      }),
      'utf8',
    );

    const s = resumir(r.filas);
    const m = (k: string) => s.metricas.find((x) => x.metrica === k)!;
    const f = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '—');
    console.log(
      `\nListo en ${((performance.now() - inicio) / 1000).toFixed(1)} s. Resumen (sistema vs. línea base, promedios):`,
    );
    console.log(
      `  comparables ${s.comparables}/${s.escenarios} · sin solución ${s.sinSolucionCompleto} · sin solución por preselección ${s.sinSolucionPorPreseleccion} · elección descartada con todos los cargadores ${s.sistemaDescartadoEnCompleto}`,
    );
    for (const k of ['criterioKm', 'distanciaKm', 'totalMin', 'costo']) {
      console.log(
        `  ${k.padEnd(12)} sistema ${f(m(k).sistemaPromedio).padStart(8)} · base ${f(m(k).basePromedio).padStart(8)} · mejora ${f(m(k).mejoraPromedioPct)} %`,
      );
    }
    console.log(
      `  elige distinto que la base: ${f(s.distintoDeBasePct)} % · igual al óptimo: ${f(s.igualAlOptimoPct)} % · optimalidad promedio: ${f(s.optimalidad.promedio)} %`,
    );
    if (viajes.length > 0) {
      const v = resumirViajes('Todos', viajes);
      console.log(
        `  viajes largos: ${v.escenarios} · posibles ${v.posiblesSistema} (todos los cargadores: ${v.posiblesCompleto}) · paradas ${f(v.paradasPromedio)} · tiempo total sistema ${f(v.totalMinSistema)} min vs base ${f(v.totalMinBase)} (mejora ${f(v.mejoraVsBasePct)} %) · sobre el mínimo ${f(v.sobreMinimoPct)} %`,
      );
    }
    console.log(
      `\nArchivos: ${path.relative(process.cwd(), path.join(SALIDA, 'resultados.md'))} y resultados.csv`,
    );
  } finally {
    await db.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof ConfigError ? error.message : error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
