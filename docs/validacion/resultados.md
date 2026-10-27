# Validación del motor de recomendación

> Generado con `npm run validate -- --scenarios 200 --seed 42` (proveedor de rutas: **offline**).
> Los datos son **sintéticos** (seed de demostración). Ver el detalle por escenario en `resultados.csv`.
> Este archivo se regenera en cada corrida; los números salen tal cual del cálculo.

## Método

- **Escenarios:** 200 generados con semilla 42. Vehículo al azar del catálogo, batería uniforme de 0 a 100 %, origen al azar en Córdoba capital, día y hora al azar dentro de la semana del 2026-11-02 (la misma semana de la ocupación sintética del seed). El 20 % se pidió en modo ruta, hacia Villa Carlos Paz o Alta Gracia.
- **Sistema:** el mismo camino que `POST /recomendaciones`. Preselección espacial de hasta 8 cargadores compatibles (radio de 20 km o corredor de 5 km por tramos), RoutingProvider y motor (WSM con rango mínimo, D-026). Se toma el primer recomendado.
- **Línea base ("selección manual simulada"):** entre **todos** los cargadores activos (58) que son compatibles, alcanzables y están disponibles, el más cercano (en modo ruta, el de menor desvío). Es lo que haría una persona mirando un mapa. Se le supone información perfecta de compatibilidad y disponibilidad, un supuesto favorable a la base.
- **Óptimo:** el mejor puntaje del motor evaluando todos los cargadores activos por fuerza bruta, sin preselección.
- **Grado de optimalidad:** puntaje del cargador elegido por el sistema dividido el puntaje del óptimo, **ambos calculados en el conjunto completo**. Los puntajes min–max solo se pueden comparar dentro de un mismo conjunto. Mide cuánto se pierde por evaluar solo los candidatos preseleccionados.
- **Métricas** del cargador elegido: distancia al cargador, espera, tiempo de carga, tiempo total (viaje + espera + carga) y costo estimado. **Mejora del sistema** = (base − sistema) / base sobre los promedios: un valor positivo significa que el sistema es mejor (menor), uno negativo que es peor.

## Resultados

- Escenarios: **200**. Con solución para el sistema y para la base: **185**.
- Sin solución evaluando todos los cargadores: **14** (FUERA_DE_AUTONOMIA: 13, SIN_DISPONIBILIDAD: 1). En esos casos nadie podría recomendar nada: por ejemplo, batería insuficiente o sin cargadores compatibles disponibles.
- Sin solución **solo por la preselección** (había un cargador factible fuera de los candidatos): **1**.
- El sistema elige un cargador **distinto** que la línea base en el **34,6 %** de los escenarios comparables.
- El sistema elige el **óptimo** del conjunto completo en el **52,4 %** de los escenarios comparables.
- **Grado de optimalidad:** promedio **97,9 %**, mediana 100,0 %, mínimo 76,1 %.

### Sistema frente a línea base

| Métrica | Sistema (prom.) | Línea base (prom.) | Mejora del sistema | Sistema (mediana) | Línea base (mediana) | Sistema mejor / igual / peor |
|---|---:|---:|---:|---:|---:|---:|
| Cercanía: distancia (ubicación) o desvío (ruta), km | 3,3 | 3,0 | -12,1 % | 2,5 | 2,2 | 0 % / 65 % / 35 % |
| Distancia del origen al cargador (km) | 5,7 | 6,7 | +15,1 % | 4,0 | 4,0 | 9 % / 65 % / 26 % |
| Espera (min) | 1,8 | 4,4 | +59,6 % | 0,0 | 0,0 | 4 % / 96 % / 0 % |
| Tiempo de carga (min) | 73,7 | 78,8 | +6,4 % | 39,5 | 38,7 | 14 % / 72 % / 14 % |
| Tiempo total: viaje + espera + carga (min) | 84,4 | 92,8 | +9,1 % | 52,2 | 55,2 | 18 % / 65 % / 16 % |
| Costo estimado (ARS) | 8.375,6 | 8.429,0 | +0,6 % | 5.099,0 | 5.688,0 | 25 % / 65 % / 10 % |

### Por urgencia

| Grupo | Escenarios | Con solución | Cercanía, km: sistema / base (mejora) | Tiempo total, min: sistema / base (mejora) | Costo, ARS: sistema / base (mejora) | Elige distinto que la base | Optimalidad promedio |
|---|---:|---:|---:|---:|---:|---:|---:|
| Urgencia alta | 64 | 49 | 2,97 / 2,94 (-1,2 %) | 136,8 / 161,1 (+15,1 %) | 17.915 / 16.806 (-6,6 %) | 16 % | 98,1 % |
| Urgencia media | 74 | 74 | 3,21 / 3,04 (-5,7 %) | 84,5 / 92,2 (+8,3 %) | 7.804 / 8.092 (+3,6 %) | 30 % | 98,4 % |
| Urgencia baja | 62 | 62 | 3,74 / 2,91 (-28,7 %) | 42,9 / 39,6 (-8,2 %) | 1.518 / 2.211 (+31,3 %) | 55 % | 97,1 % |

### Por modo de búsqueda

| Grupo | Escenarios | Con solución | Cercanía, km: sistema / base (mejora) | Tiempo total, min: sistema / base (mejora) | Costo, ARS: sistema / base (mejora) | Elige distinto que la base | Optimalidad promedio |
|---|---:|---:|---:|---:|---:|---:|---:|
| Ubicación | 154 | 145 | 3,99 / 3,68 (-8,3 %) | 88,9 / 93,0 (+4,4 %) | 7.945 / 8.052 (+1,3 %) | 28 % | 98,3 % |
| Ruta | 46 | 40 | 0,92 / 0,38 (-141,6 %) | 67,9 / 92,1 (+26,2 %) | 9.936 / 9.796 (-1,4 %) | 57 % | 96,6 % |

## Lectura de los resultados

- **Cercanía:** por definición, la línea base elige el cargador factible más cercano (en modo ruta, el de menor desvío), así que el sistema no puede mejorarla en cercanía. Lo esperable es ceder cercanía a cambio de mejores tiempos o costos. La tabla muestra cuánto se cede.
- **Distancia del origen al cargador:** en modo ruta la base minimiza el desvío, no la distancia al origen, y suele elegir cargadores más adelante en el camino. Por eso esta métrica, promediada con los dos modos juntos, puede favorecer al sistema sin que eso sea una mejora real. Para comparar cercanía hay que usar la fila de **cercanía**.
- **Ponderaciones:** el motor no optimiza una sola métrica, sino una combinación que depende de la urgencia (SPEC §6.5). Que el sistema empate o pierda en alguna métrica no implica un error. Hay que leerlo junto con las ponderaciones de cada grupo de urgencia.
- **Alcance de la optimalidad:** se mide con la función de puntaje del propio motor. Indica la pérdida por la preselección, no la satisfacción real de una persona usuaria, que no se midió.

## Limitaciones

- **Datos:** 60 cargadores con precios, horarios y reservas ficticios en Córdoba y los dos corredores. Las especificaciones de los vehículos son aproximadas.
- **Rutas:** proveedor **offline** (distancia en línea recta × 1.35 y velocidades medias por tramo), sin tráfico ni recorridos reales. Elementos consultados a servicios externos en esta corrida: 0.
- **Modelo:** carga lineal sin curva de potencia, ocupación solo por reservas (sin datos en tiempo real), espera máxima de 2 h, una sola parada (sin planificación de varias cargas) y alcance evaluado solo hasta el cargador.
- **Umbrales:** los rangos mínimos de normalización (D-026) y los pesos por urgencia son valores de diseño, no calibrados con usuarios.
- **Línea base:** es una simplificación de la búsqueda manual. Una persona real no conoce toda la disponibilidad ni evalúa todos los cargadores.
- **Muestra:** los escenarios son una muestra aleatoria con semilla fija. Con otra semilla los números cambian; conviene informar la semilla y la cantidad junto con cada resultado.
