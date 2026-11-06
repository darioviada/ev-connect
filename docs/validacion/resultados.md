# Validación del motor de recomendación

> Generado con `npm run validate -- --scenarios 200 --seed 42` (proveedor de rutas: **offline**).
> Los datos son **sintéticos** (seed de demostración). Ver el detalle por escenario en `resultados.csv`.
> Este archivo se regenera en cada corrida; los números salen tal cual del cálculo.

## Método

- **Escenarios:** 200 generados con semilla 42. Vehículo al azar del catálogo, batería uniforme de 0 a 100 %, origen al azar en Córdoba capital, día y hora al azar dentro de la semana del 2026-11-02 (la misma semana de la ocupación sintética del seed). El 20 % se pidió en modo ruta, hacia Villa Carlos Paz o Alta Gracia.
- **Sistema:** el mismo camino que `POST /recomendaciones`. Preselección espacial de hasta 8 cargadores compatibles (radio de 20 km o corredor de 5 km por tramos), RoutingProvider y motor (WSM con rango mínimo, D-026). Se toma el primer recomendado.
- **Línea base ("selección manual simulada"):** entre **todos** los cargadores activos (70) que son compatibles, alcanzables y están disponibles, el más cercano (en modo ruta, el de menor desvío). Es lo que haría una persona mirando un mapa. Se le supone información perfecta de compatibilidad y disponibilidad, un supuesto favorable a la base.
- **Óptimo:** el mejor puntaje del motor evaluando todos los cargadores activos por fuerza bruta, sin preselección.
- **Grado de optimalidad:** puntaje del cargador elegido por el sistema dividido el puntaje del óptimo, **ambos calculados en el conjunto completo**. Los puntajes min–max solo se pueden comparar dentro de un mismo conjunto. Mide cuánto se pierde por evaluar solo los candidatos preseleccionados.
- **Métricas** del cargador elegido: distancia al cargador, espera, tiempo de carga, tiempo total (viaje + espera + carga) y costo estimado. En modo ruta, cuando con la batería actual no se llega al destino, espera, carga, tiempo total y costo son los del **viaje completo** (plan de viaje, D-045), que es lo que puntúa el motor. **Mejora del sistema** = (base − sistema) / base sobre los promedios: un valor positivo significa que el sistema es mejor (menor), uno negativo que es peor.

## Resultados

- Escenarios: **200**. Con solución para el sistema y para la base: **186**.
- Sin solución evaluando todos los cargadores: **14** (FUERA_DE_AUTONOMIA: 13, SIN_DISPONIBILIDAD: 1). En esos casos nadie podría recomendar nada: por ejemplo, batería insuficiente o sin cargadores compatibles disponibles.
- Sin solución **solo por la preselección** (había un cargador factible fuera de los candidatos): **0**.
- El sistema elige un cargador **distinto** que la línea base en el **34,9 %** de los escenarios comparables.
- El sistema elige el **óptimo** del conjunto completo en el **44,6 %** de los escenarios comparables.
- **Grado de optimalidad:** promedio **97,3 %**, mediana 99,5 %, mínimo 79,1 %.

### Sistema frente a línea base

| Métrica | Sistema (prom.) | Línea base (prom.) | Mejora del sistema | Sistema (mediana) | Línea base (mediana) | Sistema mejor / igual / peor |
|---|---:|---:|---:|---:|---:|---:|
| Cercanía: distancia (ubicación) o desvío (ruta), km | 3,3 | 3,0 | -12,3 % | 2,5 | 2,1 | 0 % / 65 % / 35 % |
| Distancia del origen al cargador (km) | 5,7 | 6,7 | +15,1 % | 3,9 | 4,0 | 9 % / 65 % / 26 % |
| Espera (min) | 1,8 | 4,4 | +59,6 % | 0,0 | 0,0 | 4 % / 96 % / 0 % |
| Tiempo de carga (min) | 72,6 | 77,7 | +6,5 % | 39,1 | 38,4 | 13 % / 72 % / 15 % |
| Tiempo total: viaje + espera + carga (min) | 83,9 | 92,3 | +9,1 % | 52,2 | 55,3 | 18 % / 65 % / 17 % |
| Costo estimado (ARS) | 8.184,0 | 8.231,0 | +0,6 % | 4.796,0 | 5.396,5 | 25 % / 65 % / 10 % |

### Por urgencia

| Grupo | Escenarios | Con solución | Cercanía, km: sistema / base (mejora) | Tiempo total, min: sistema / base (mejora) | Costo, ARS: sistema / base (mejora) | Elige distinto que la base | Optimalidad promedio |
|---|---:|---:|---:|---:|---:|---:|---:|
| Urgencia alta | 64 | 50 | 2,94 / 2,88 (-2,1 %) | 133,9 / 157,7 (+15,1 %) | 17.011 / 15.901 (-7,0 %) | 18 % | 97,8 % |
| Urgencia media | 74 | 74 | 3,21 / 3,04 (-5,7 %) | 84,5 / 92,2 (+8,3 %) | 7.804 / 8.092 (+3,6 %) | 30 % | 97,7 % |
| Urgencia baja | 62 | 62 | 3,74 / 2,91 (-28,7 %) | 42,9 / 39,6 (-8,2 %) | 1.518 / 2.211 (+31,3 %) | 55 % | 96,4 % |

### Por modo de búsqueda

| Grupo | Escenarios | Con solución | Cercanía, km: sistema / base (mejora) | Tiempo total, min: sistema / base (mejora) | Costo, ARS: sistema / base (mejora) | Elige distinto que la base | Optimalidad promedio |
|---|---:|---:|---:|---:|---:|---:|---:|
| Ubicación | 154 | 145 | 3,99 / 3,68 (-8,3 %) | 88,9 / 93,0 (+4,4 %) | 7.945 / 8.052 (+1,3 %) | 28 % | 97,4 % |
| Ruta | 46 | 41 | 0,94 / 0,38 (-148,0 %) | 66,0 / 89,6 (+26,3 %) | 9.028 / 8.864 (-1,9 %) | 59 % | 96,9 % |


## Viajes largos con paradas (D-045)

- **Escenarios:** 60, aparte de los anteriores, generados con la misma semilla. Origen al azar en Córdoba capital; destino Rosario, Buenos Aires o Mendoza (en rotación); vehículo al azar del catálogo; batería de 20 a 100 %; salida de día (6 a 18 h) dentro de la misma semana. Entre Córdoba y Mendoza el seed no tiene cargadores a propósito.
- **Sistema:** el mismo camino que la API: primeras paradas preseleccionadas y, para cada una, el plan de viaje (Dijkstra por hora de llegada). Se toma el primer recomendado y su plan.
- **Línea base:** entre todas las primeras paradas posibles (todos los cargadores activos), la de menor desvío, completada con el mismo planificador. Representa a quien carga "lo más en el camino posible".
- **Mínimo:** el plan de menor tiempo total entre todas las primeras paradas posibles (fuerza bruta). El sistema no minimiza solo el tiempo (pondera también desvío y costo según la urgencia), así que puede quedar por encima.
- **Tiempo total:** manejo + esperas + cargas hasta el destino. Los tramos entre paradas se estiman (línea recta × factor de circuito del trayecto directo).
- **Sin solución** evaluando todos los cargadores: **30** (VIAJE_NO_POSIBLE: 29, SIN_DISPONIBILIDAD: 1).

| Destino | Escenarios | Viaje posible: sistema / todos | Paradas (prom.) | Tiempo total, min: sistema / base (mejora) | Mínimo posible, min | Sistema sobre el mínimo |
|---|---:|---:|---:|---:|---:|---:|
| Todos | 60 | 30 / 30 | 3,1 | 554 / 590 (+6,1 %) | 538 | 3,0 % (mediana 0,0 %) |
| Rosario | 20 | 14 / 14 | 2,2 | 418 / 457 (+8,5 %) | 403 | 3,8 % (mediana 0,1 %) |
| Buenos Aires | 20 | 16 / 16 | 3,8 | 672 / 706 (+4,7 %) | 656 | 2,2 % (mediana 0,0 %) |
| Mendoza | 20 | 0 / 0 | — | — / — (—) | — | — % (mediana — %) |

Detalle por escenario en `resultados-viajes.csv`.

## Lectura de los resultados

- **Cercanía:** por definición, la línea base elige el cargador factible más cercano (en modo ruta, el de menor desvío), así que el sistema no puede mejorarla en cercanía. Lo esperable es ceder cercanía a cambio de mejores tiempos o costos. La tabla muestra cuánto se cede.
- **Distancia del origen al cargador:** en modo ruta la base minimiza el desvío, no la distancia al origen, y suele elegir cargadores más adelante en el camino. Por eso esta métrica, promediada con los dos modos juntos, puede favorecer al sistema sin que eso sea una mejora real. Para comparar cercanía hay que usar la fila de **cercanía**.
- **Ponderaciones:** el motor no optimiza una sola métrica, sino una combinación que depende de la urgencia (SPEC §6.5). Que el sistema empate o pierda en alguna métrica no implica un error. Hay que leerlo junto con las ponderaciones de cada grupo de urgencia.
- **Alcance de la optimalidad:** se mide con la función de puntaje del propio motor. Indica la pérdida por la preselección, no la satisfacción real de una persona usuaria, que no se midió.

## Limitaciones

- **Datos:** 70 cargadores activos con precios, horarios y reservas ficticios en Córdoba, los corredores a Villa Carlos Paz y Alta Gracia y la RN 9 a Buenos Aires. Las especificaciones de los vehículos son aproximadas.
- **Rutas:** proveedor **offline** (distancia en línea recta × 1.35, menos en tramos de más de 50 km, y velocidades medias por tramo), sin tráfico ni recorridos reales. Elementos consultados a servicios externos en esta corrida: 0.
- **Modelo:** carga lineal sin curva de potencia, ocupación solo por reservas (sin datos en tiempo real), espera máxima de 2 h. Los planes de viaje (D-045) estiman los tramos entre paradas y minimizan el tiempo de llegada, no el costo.
- **Umbrales:** los rangos mínimos de normalización (D-026) y los pesos por urgencia son valores de diseño, no calibrados con usuarios.
- **Línea base:** es una simplificación de la búsqueda manual. Una persona real no conoce toda la disponibilidad ni evalúa todos los cargadores.
- **Muestra:** los escenarios son una muestra aleatoria con semilla fija. Con otra semilla los números cambian; conviene informar la semilla y la cantidad junto con cada resultado.
