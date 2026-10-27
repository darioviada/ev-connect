// Salidas de la validación: CSV (una fila por escenario) y Markdown (resumen, método y limitaciones).
// Los números salen tal cual del cálculo: no se redondea a favor ni se descartan escenarios.
import { resumir, type FilaEscenario, type Metrica, type Resumen } from './analisis.js';

const COLUMNAS_ELECCION = [
  'id',
  'nombre',
  'criterioKm',
  'distanciaKm',
  'desvioKm',
  'esperaMin',
  'cargaMin',
  'totalMin',
  'costo',
  'scoreConjuntoCompleto',
] as const;

function celda(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'number')
    return Number.isFinite(valor) ? String(Math.round(valor * 1000) / 1000) : '';
  const texto = String(valor);
  return /[",\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function aCsv(filas: readonly FilaEscenario[]): string {
  const encabezado = [
    'escenario',
    'modo',
    'vehiculo',
    'conector',
    'bateria_pct',
    'urgencia',
    'fecha',
    'hora',
    'destino',
    'candidatos_sistema',
    'preseleccion_ampliada',
    'factibles',
    ...['sistema', 'base', 'optimo'].flatMap((q) => COLUMNAS_ELECCION.map((c) => `${q}_${c}`)),
    'optimalidad_pct',
    'sistema_igual_base',
    'sistema_igual_optimo',
    'sin_solucion_sistema',
    'sin_solucion_completo',
  ];
  const lineas = filas.map((f) =>
    [
      f.id,
      f.modo,
      f.vehiculo,
      f.conector,
      f.bateriaPct,
      f.urgencia,
      f.fecha,
      f.hora,
      f.destino,
      f.candidatosSistema,
      f.preseleccionAmpliada,
      f.factibles,
      ...[f.sistema, f.base, f.optimo].flatMap((e) =>
        COLUMNAS_ELECCION.map((c) => (e ? e[c] : null)),
      ),
      f.optimalidadPct,
      f.sistema && f.base ? f.sistema.id === f.base.id : null,
      f.sistema && f.optimo ? f.sistema.id === f.optimo.id : null,
      f.sinSolucionSistema,
      f.sinSolucionCompleto,
    ]
      .map(celda)
      .join(','),
  );
  return [encabezado.join(','), ...lineas].join('\n') + '\n';
}

// --- Markdown -----------------------------------------------------------------------------------

const num = (x: number, decimales = 1) =>
  Number.isFinite(x)
    ? x.toLocaleString('es-AR', {
        minimumFractionDigits: decimales,
        maximumFractionDigits: decimales,
      })
    : '—';
const signo = (x: number) => (Number.isFinite(x) ? `${x > 0 ? '+' : ''}${num(x)} %` : '—');

const NOMBRES: Record<Metrica, string> = {
  criterioKm: 'Cercanía: distancia (ubicación) o desvío (ruta), km',
  distanciaKm: 'Distancia del origen al cargador (km)',
  esperaMin: 'Espera (min)',
  cargaMin: 'Tiempo de carga (min)',
  totalMin: 'Tiempo total: viaje + espera + carga (min)',
  costo: 'Costo estimado (ARS)',
};

function tablaComparativa(r: Resumen): string {
  const filas = r.metricas.map(
    (m) =>
      `| ${NOMBRES[m.metrica]} | ${num(m.sistemaPromedio)} | ${num(m.basePromedio)} | ${signo(m.mejoraPromedioPct)} | ${num(m.sistemaMediana)} | ${num(m.baseMediana)} | ${num(m.mejorPct, 0)} % / ${num(m.igualPct, 0)} % / ${num(m.peorPct, 0)} % |`,
  );
  return [
    '| Métrica | Sistema (prom.) | Línea base (prom.) | Mejora del sistema | Sistema (mediana) | Línea base (mediana) | Sistema mejor / igual / peor |',
    '|---|---:|---:|---:|---:|---:|---:|',
    ...filas,
  ].join('\n');
}

function tablaPorGrupo(titulo: string, grupos: [string, FilaEscenario[]][]): string {
  const filas = grupos
    .filter(([, fs]) => fs.length > 0)
    .map(([nombre, fs]) => {
      const r = resumir(fs);
      const m = (k: Metrica) => r.metricas.find((x) => x.metrica === k)!;
      // Valores absolutos junto al porcentaje: con promedios chicos (p. ej. desvíos < 1 km) el % exagera.
      const par = (k: Metrica, d = 1) =>
        `${num(m(k).sistemaPromedio, d)} / ${num(m(k).basePromedio, d)} (${signo(m(k).mejoraPromedioPct)})`;
      return `| ${nombre} | ${r.escenarios} | ${r.comparables} | ${par('criterioKm', 2)} | ${par('totalMin')} | ${par('costo', 0)} | ${num(r.distintoDeBasePct, 0)} % | ${num(r.optimalidad.promedio)} % |`;
    });
  return [
    `| ${titulo} | Escenarios | Con solución | Cercanía, km: sistema / base (mejora) | Tiempo total, min: sistema / base (mejora) | Costo, ARS: sistema / base (mejora) | Elige distinto que la base | Optimalidad promedio |`,
    '|---|---:|---:|---:|---:|---:|---:|---:|',
    ...filas,
  ].join('\n');
}

export interface ParametrosInforme {
  cantidad: number;
  semilla: number;
  proporcionRuta: number;
  proveedor: string;
  fechaBase: string;
  cargadoresActivos: number;
  candidatosLimite: number;
  radioKm: number;
  corredorKm: number;
  elementosConsultados: number;
}

export function aMarkdown(filas: readonly FilaEscenario[], p: ParametrosInforme): string {
  const r = resumir(filas);
  const porUrgencia: [string, FilaEscenario[]][] = (['alta', 'media', 'baja'] as const).map((u) => [
    `Urgencia ${u}`,
    filas.filter((f) => f.urgencia === u),
  ]);
  const porModo: [string, FilaEscenario[]][] = [
    ['Ubicación', filas.filter((f) => f.modo === 'ubicacion')],
    ['Ruta', filas.filter((f) => f.modo === 'ruta')],
  ];
  const motivos = new Map<string, number>();
  for (const f of filas) {
    if (f.sinSolucionCompleto)
      motivos.set(f.sinSolucionCompleto, (motivos.get(f.sinSolucionCompleto) ?? 0) + 1);
  }

  return `# Validación del motor de recomendación

> Generado con \`npm run validate -- --scenarios ${p.cantidad} --seed ${p.semilla}\` (proveedor de rutas: **${p.proveedor}**).
> Los datos son **sintéticos** (seed de demostración). Ver el detalle por escenario en \`resultados.csv\`.
> Este archivo se regenera en cada corrida; los números salen tal cual del cálculo.

## Método

- **Escenarios:** ${p.cantidad} generados con semilla ${p.semilla}. Vehículo al azar del catálogo, batería uniforme de 0 a 100 %, origen al azar en Córdoba capital, día y hora al azar dentro de la semana del ${p.fechaBase} (la misma semana de la ocupación sintética del seed). El ${num(p.proporcionRuta * 100, 0)} % se pidió en modo ruta, hacia Villa Carlos Paz o Alta Gracia.
- **Sistema:** el mismo camino que \`POST /recomendaciones\`. Preselección espacial de hasta ${p.candidatosLimite} cargadores compatibles (radio de ${p.radioKm} km o corredor de ${p.corredorKm} km por tramos), RoutingProvider y motor (WSM con rango mínimo, D-026). Se toma el primer recomendado.
- **Línea base ("selección manual simulada"):** entre **todos** los cargadores activos (${p.cargadoresActivos}) que son compatibles, alcanzables y están disponibles, el más cercano (en modo ruta, el de menor desvío). Es lo que haría una persona mirando un mapa. Se le supone información perfecta de compatibilidad y disponibilidad, un supuesto favorable a la base.
- **Óptimo:** el mejor puntaje del motor evaluando todos los cargadores activos por fuerza bruta, sin preselección.
- **Grado de optimalidad:** puntaje del cargador elegido por el sistema dividido el puntaje del óptimo, **ambos calculados en el conjunto completo**. Los puntajes min–max solo se pueden comparar dentro de un mismo conjunto. Mide cuánto se pierde por evaluar solo los candidatos preseleccionados.
- **Métricas** del cargador elegido: distancia al cargador, espera, tiempo de carga, tiempo total (viaje + espera + carga) y costo estimado. **Mejora del sistema** = (base − sistema) / base sobre los promedios: un valor positivo significa que el sistema es mejor (menor), uno negativo que es peor.

## Resultados

- Escenarios: **${r.escenarios}**. Con solución para el sistema y para la base: **${r.comparables}**.
- Sin solución evaluando todos los cargadores: **${r.sinSolucionCompleto}**${motivos.size ? ` (${[...motivos].map(([m, n]) => `${m}: ${n}`).join(', ')})` : ''}. En esos casos nadie podría recomendar nada: por ejemplo, batería insuficiente o sin cargadores compatibles disponibles.
- Sin solución **solo por la preselección** (había un cargador factible fuera de los candidatos): **${r.sinSolucionPorPreseleccion}**.
- El sistema elige un cargador **distinto** que la línea base en el **${num(r.distintoDeBasePct)} %** de los escenarios comparables.
- El sistema elige el **óptimo** del conjunto completo en el **${num(r.igualAlOptimoPct)} %** de los escenarios comparables.
- **Grado de optimalidad:** promedio **${num(r.optimalidad.promedio)} %**, mediana ${num(r.optimalidad.mediana)} %, mínimo ${num(r.optimalidad.minimo)} %.

### Sistema frente a línea base

${tablaComparativa(r)}

### Por urgencia

${tablaPorGrupo('Grupo', porUrgencia)}

### Por modo de búsqueda

${tablaPorGrupo('Grupo', porModo)}

## Lectura de los resultados

- **Cercanía:** por definición, la línea base elige el cargador factible más cercano (en modo ruta, el de menor desvío), así que el sistema no puede mejorarla en cercanía. Lo esperable es ceder cercanía a cambio de mejores tiempos o costos. La tabla muestra cuánto se cede.
- **Distancia del origen al cargador:** en modo ruta la base minimiza el desvío, no la distancia al origen, y suele elegir cargadores más adelante en el camino. Por eso esta métrica, promediada con los dos modos juntos, puede favorecer al sistema sin que eso sea una mejora real. Para comparar cercanía hay que usar la fila de **cercanía**.
- **Ponderaciones:** el motor no optimiza una sola métrica, sino una combinación que depende de la urgencia (SPEC §6.5). Que el sistema empate o pierda en alguna métrica no implica un error. Hay que leerlo junto con las ponderaciones de cada grupo de urgencia.
- **Alcance de la optimalidad:** se mide con la función de puntaje del propio motor. Indica la pérdida por la preselección, no la satisfacción real de una persona usuaria, que no se midió.

## Limitaciones

- **Datos:** 60 cargadores con precios, horarios y reservas ficticios en Córdoba y los dos corredores. Las especificaciones de los vehículos son aproximadas.
- **Rutas:** ${p.proveedor === 'offline' ? 'proveedor **offline** (distancia en línea recta × 1.35 y velocidades medias por tramo), sin tráfico ni recorridos reales' : 'proveedor **Google Routes** sin tráfico (TRAFFIC_UNAWARE)'}. Elementos consultados a servicios externos en esta corrida: ${p.elementosConsultados}.
- **Modelo:** carga lineal sin curva de potencia, ocupación solo por reservas (sin datos en tiempo real), espera máxima de 2 h, una sola parada (sin planificación de varias cargas) y alcance evaluado solo hasta el cargador.
- **Umbrales:** los rangos mínimos de normalización (D-026) y los pesos por urgencia son valores de diseño, no calibrados con usuarios.
- **Línea base:** es una simplificación de la búsqueda manual. Una persona real no conoce toda la disponibilidad ni evalúa todos los cargadores.
- **Muestra:** los escenarios son una muestra aleatoria con semilla fija. Con otra semilla los números cambian; conviene informar la semilla y la cantidad junto con cada resultado.
`;
}
