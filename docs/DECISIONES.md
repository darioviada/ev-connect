# DECISIONES — Desvíos y aclaraciones respecto de SPEC

Registro de decisiones tomadas durante la construcción: fecha, decisión, motivo e impacto.
Complementa la sección 15 de `docs/SPEC.md` (diferencias con el informe).

## 2026-10-27 — Fase 0

### D-001 · Alcance geográfico: toda la Argentina
- **Decisión:** el sistema no queda atado a Córdoba. No hay coordenadas, límites ni listas fijas de Córdoba en la lógica:
  cualquier cargador del país se puede publicar y buscar. Córdoba sigue siendo la **zona piloto** del seed (SPEC §11) y de los escenarios de `npm run validate` (SPEC §12).
- **Motivo:** aclaración del autor. Con Google Routes API y la red colaborativa el sistema aplica a cualquier punto del país.
- **Impacto:**
  - La geocodificación `static` incluirá las ciudades principales del país además de barrios de Córdoba (Fase 3).
  - Nominatim ya usa `countrycodes=ar`.
  - El centro inicial del mapa es configurable (por defecto Córdoba por el seed).
  - `TZ` sigue siendo `America/Argentina/Cordoba`: todo el país usa el mismo huso (UTC−3).
  - En el informe conviene aclarar "alcance nacional, piloto en Córdoba".

### D-002 · TypeScript 6.0 en lugar de 7.x
- **Decisión:** se fija `typescript@~6.0.3`.
- **Motivo:** `typescript-eslint` 8.72 (última versión) declara compatibilidad `typescript >=4.8.4 <6.1.0`. TypeScript 7 (compilador nativo) todavía no está soportado.
- **Impacto:** ninguno funcional. Revisar al cerrar el proyecto si `typescript-eslint` ya soporta TS 7.

### D-003 · `JWT_SECRET` de demostración en `.env.example`
- **Decisión:** `.env.example` trae un valor de demostración para que `cp .env.example .env` funcione sin editar nada (RUN_LOCAL).
  La API lo acepta con una advertencia en el log y **se niega a arrancar** con ese valor si `NODE_ENV=production`. El secreto debe tener al menos 32 caracteres.
- **Motivo:** conciliar "secretos nunca en el repo" (CLAUDE.md) con "no hace falta editar nada" (RUN_LOCAL).
- **Impacto:** a resolver en la Fase 7. El contenedor único de `docker compose up --build` corre en modo demo local; ahí se generará un secreto aleatorio al arrancar o se fijará `NODE_ENV` de forma que la regla no lo bloquee. En la nube se usa `AUTH_MODE=cognito`, donde `JWT_SECRET` no aplica.

### D-004 · Un único `.env` en la raíz
- **Decisión:** la API busca `.env` subiendo directorios desde el directorio de trabajo y lo carga con `process.loadEnvFile` de Node (sin `dotenv`).
  Las variables ya definidas en el entorno tienen prioridad (verificado). Vite lo lee con `envDir: '..'` y solo expone las `VITE_*`.
- **Motivo:** una sola fuente de configuración para la demo, sin dependencias extra.

### D-005 · Proxy de Vite en desarrollo
- **Decisión:** en `npm run dev` la web (5173) reenvía `/api` a la API (`PORT`, 3000). `VITE_API_URL=/api/v1` es relativo.
- **Motivo:** mismo origen en desarrollo y en producción (la API sirve el build de la web), así no hacen falta ajustes de CORS para la demo. `CORS_ORIGIN` se mantiene para otros escenarios.

### D-006 · Migraciones con un ejecutor propio sobre la API de knex
- **Decisión:** `npm run db:migrate` ejecuta `api/src/db/migrate.ts`, que llama a `knex.migrate.latest()`:
  - `migrations/` siempre, con la tabla de control `knex_migrations`;
  - `migrations_dev/` solo con `AUTH_MODE=local`, con **su propia tabla de control** `knex_migrations_dev`.
  
  Las migraciones se escriben en TypeScript. En desarrollo se ejecutan con `tsx`, y el build las compila a `api/dist/migrations` con la misma estructura relativa.
- **Motivo:** si ambas carpetas compartieran la tabla de control, migrar en modo Cognito una base que ya se migró en modo local fallaría por "migraciones faltantes".
- **Impacto:** el comando exacto dentro de la imagen de producción se define en la Fase 7.

### D-007 · Healthcheck de la base por TCP
- **Decisión:** el healthcheck de `db` usa `pg_isready -h 127.0.0.1`.
- **Motivo:** en el primer arranque, la imagen inicializa la base con un servidor temporal que solo escucha por socket. Con `pg_isready` por socket, `npm run db:up` devolvía "healthy" antes de que la base aceptara conexiones TCP, y `db:migrate` fallaba.

### D-008 · `lint` incluye formato y tipos
- **Decisión:** `npm run lint` = `eslint .` + `prettier --check .` + `tsc --noEmit` en ambos workspaces (RUN_LOCAL: "estilo y tipos").
  `docs/` y `CLAUDE.md` quedan fuera de Prettier: son del autor.

### D-009 · Commits
- **Decisión:** Claude Code hace commits pequeños y convencionales en `main`. El autor revisa al cierre de cada fase antes de pasar a la siguiente.

### Pendiente para la Fase 5 · Contraste de los tokens de color
Relaciones de contraste calculadas (WCAG 2.x). Para texto normal se exige al menos 4.5:1; para texto grande (≥ 18.66 px en negrita) alcanza con 3:1.

| Combinación | Contraste | Resultado |
|---|---|---|
| Texto blanco sobre primario `#0F9D6B` | 3.47:1 | Solo cumple para texto grande o negrita |
| Primario sobre fondo `#F4F6F3` | 3.19:1 | Solo cumple para texto grande |
| Texto atenuado `#9A9D93` sobre fondo o blanco | 2.54–2.76:1 | No cumple para texto |
| Texto secundario `#55584F` sobre fondo | 6.67:1 | Cumple |

Propuesta a confirmar con el autor antes de la Fase 5:
- Botones con texto en Sora semibold de 18 px o más.
- El atenuado, solo para elementos decorativos o deshabilitados.
- O bien oscurecer levemente esos dos tonos.

## 2026-10-27 — Fase 1

### D-010 · Esquema: agregados que no cambian el DER
- **Índices** en las claves foráneas más consultadas: `vehiculo_usuario(usuario_id)`, `cargador(usuario_id)`, `disponibilidad(cargador_id)`, `reserva(usuario_id)` y `ruta_guardada(usuario_id)`. Son solo rendimiento.
- **Vista `vehiculo_usuario_detalle`:** resuelve cada dato con `COALESCE(propio, catálogo)` y agrega la columna `personalizado` (`modelo_id IS NULL`).
- **Reservas con fin anterior al inicio:** las rechaza primero la columna generada `rango` (error de rango inválido, clase `22000`), antes que el `CHECK`. El `CHECK` actúa cuando inicio y fin son iguales. En los dos casos la reserva se rechaza. La API traducirá ambos errores a un 400 de validación (Fase 4).

### D-011 · Conversión de tipos y zona horaria en el driver `pg`
- `date` se lee como texto `YYYY-MM-DD`. Así se evita que el driver lo convierta a `Date` y lo corra de día por la zona horaria.
- `numeric` se lee como `number`.
- Cada conexión fija `TimeZone` con la zona de negocio (`TZ`). Usa `set_config` con un parámetro, sin concatenar texto.

### D-012 · Seed
- **Generación determinista:** semilla fija (`20261027`) e identificadores estables derivados de una clave (uuid con formato v5). La generación es una función pura (`api/seeds/generar.ts`) y la escritura en la base va aparte (`api/seeds/demo.ts`).
- **Idempotencia:** los datos del seed se reescriben (*upsert*) por id, y lo que crearon los usuarios se conserva. Las reservas del seed tienen fechas relativas a hoy y se regeneran en cada corrida. Si alguna choca con una reserva real, se omite. `--reset` vacía todas las tablas de datos.
- **Dueños ficticios:** 25 personas ficticias (`anfitrion-NN@demo.local`) son las dueñas de los 40 cargadores privados. No tienen credenciales, así que no pueden iniciar sesión.
- **Modo Cognito:** con `AUTH_MODE=cognito` no se crean `admin@demo.local` ni `usuario@demo.local`, ni sus vehículos, reservas, favoritos o rutas (AWS_DEPLOY §4.5). Los cargadores son idénticos en ambos modos.
- **Sin marcas reales:** los cargadores usan nombres genéricos ("Electrolinera Centro", "Wallbox García"). El mockup usa "YPF Ruta 9", pero los datos sintéticos no imitan redes reales. El catálogo sí usa modelos reales, con especificaciones aproximadas, más un modelo rotulado "ficticio" (solo `TIPO_2`, sin DC) para el filtro de compatibilidad.
- **Distribución:** 45 cargadores en Córdoba capital, 6 en el corredor a Villa Carlos Paz, 5 en el corredor a Alta Gracia y 4 en Rosario y CABA (D-001). Hay 2 privados inactivos, 3 cargadores `CHADEMO` y potencias de 7.4 a 150 kW.
- **Usuario demo:** tiene una reserva de cada estado (confirmada hoy, pendiente mañana, cancelada hace 3 días), como en el mockup "Mis reservas". Las reservas pendientes también bloquean el horario: la restricción solo excluye las canceladas.

### D-013 · Tests de integración en una base aparte
- Usan la base `<base>_test` en el mismo servidor, o `TEST_DATABASE_URL`. La crean y la migran si hace falta, así nunca tocan la base de desarrollo.
- Cada test corre dentro de una transacción que se revierte. Los archivos se ejecutan de a uno (`fileParallelism: false`).
- **Impacto:** `npm test` necesita la base levantada (`npm run db:up`). Si no está, el error lo indica.

### D-014 · Revertir migraciones
- `npm run db:migrate -- --down` revierte todas las migraciones. Es solo para desarrollo y borra los datos.

### Observación para la Fase 4 · Preselección en modo ruta
La preselección por corredor (`ST_DWithin` contra la línea origen→destino, ordenada por distancia y con `LIMIT 8`) incluye toda la ciudad de origen: 39 cargadores activos caen en el corredor a Carlos Paz. Ordenar por distancia a la línea no prioriza los cargadores que están más adelante en el camino. Con 8 candidatos, la recomendación en ruta podría quedar en cargadores del centro. Opciones a decidir antes de la Fase 4:
- **(a)** Ordenar por la posición a lo largo de la ruta (`ST_LineLocatePoint`) en lugar de por la distancia a la línea.
- **(b)** Repartir los candidatos en tramos de la ruta.
- **(c)** Dejarlo como está y documentarlo como limitación.

## 2026-10-27 — Fase 2

### D-015 · Alta automática del usuario en cada solicitud autenticada
- **Decisión:** el middleware `autenticar` crea el registro en `usuario` la primera vez que ve un `sub`. No solo lo hace `GET /yo`, como dice el SPEC. Si el correo del token cambió, lo actualiza.
- **Motivo:** en modo Cognito un usuario puede llegar a cualquier endpoint protegido sin haber pasado antes por `/yo`. Sin la fila en `usuario` no hay `usuario_id` para sus reservas o vehículos.
- **Impacto:** `/yo` sigue respondiendo el perfil como define el SPEC. Si el correo ya pertenece a otra cuenta, la respuesta es 409 `EMAIL_EN_USO`.

### D-016 · Token del modo local
- HS256 solamente. Emisor `ev-connect-local`, audiencia `ev-connect` y vencimiento de 8 horas.
- Lleva las mismas claims que un ID token de Cognito: `sub`, `email`, `name`, `cognito:groups` y `token_use: "id"`.
- El rol se toma de `dev_credencial.rol` al iniciar sesión. Si un admin cambia el rol de alguien (P2), el cambio rige desde su próximo login.
- **Verificado contra la documentación de `aws-jwt-verify` 5.2.1:** el modo Cognito usa `CognitoJwtVerifier.create({ userPoolId, tokenUse: "id", clientId })`. El verificador valida firma (JWKS del User Pool), emisor, audiencia, vencimiento y `token_use`. Las claves se descargan recién al verificar el primer token válido, así que no hace falta conexión para arrancar ni para los tests.

### D-017 · Comportamiento de autenticación
- **Token inválido:** un token presente pero inválido recibe **401 aunque la ruta admita invitados**. No se degrada a invitado: así un token vencido no pasa inadvertido.
- **Correos:** se guardan normalizados (sin espacios y en minúsculas).
- **Login local:** devuelve el mismo error y tarda lo mismo si el correo no existe o si la contraseña es incorrecta (compara contra un hash señuelo), para no revelar qué correos están registrados.
- **Usuario deshabilitado:** recibe 403 `USUARIO_INACTIVO` también al iniciar sesión.

### D-018 · Límite de intentos en registro y login local
- **Decisión:** `express-rate-limit` en `/auth/local/*`: 20 intentos cada 15 minutos por IP. Al superarlo responde 429 `DEMASIADOS_INTENTOS`.
- **Motivo:** protección básica contra fuerza bruta. El SPEC solo pide límite en `/recomendaciones` y `/geocodificar`, que se agregan en la Fase 4.
- **Impacto:** detrás del Application Load Balancer hay que configurar `trust proxy` para que el límite use la IP real del cliente. Va en la Fase 7.

### D-019 · Alcance de los tests de la Fase 2
- **Permisos:** se prueban con rutas de prueba (invitado, user, admin, dueño, deshabilitado). La matriz de SPEC §2 sobre los endpoints reales se completa en la Fase 4, cuando existan.
- **Cognito:** se prueba con un verificador simulado y, además, con el verificador real ante un token mal formado (no sale a la red).
- **Independencia del orden:** detecté y corregí tests que dependían del orden de ejecución dentro de su archivo. Ahora cada test arma su propio estado. Se verificó con `vitest --sequence.shuffle` en varias corridas.

## 2026-10-27 — Fase 3

### D-020 · Respuestas del autor a las dudas abiertas (se implementan en la Fase 4)
1. **Preselección en modo ruta:** se ordena por el avance sobre la ruta (`ST_LineLocatePoint`). Ver la aclaración de D-025.
2. **Reserva `pendiente`:** el usuario reservó, pero el dueño del cargador todavía no la aceptó. Interpretación confirmada por el autor:
   - Una reserva en un cargador **privado** nace `pendiente`; en uno **público**, `confirmada`, porque no hay dueño que apruebe.
   - El dueño (o un admin) la **acepta** y pasa a `confirmada`, o la **rechaza** y pasa a `cancelada`.
   - Mientras está pendiente, el horario queda bloqueado (la restricción `EXCLUDE` solo excluye las canceladas), y el motor la cuenta como ocupación.
   - Se agregan endpoints que el SPEC §8 no tenía: `PATCH /reservas/:id/aceptar`, `PATCH /reservas/:id/rechazar` y un listado de las reservas recibidas en los cargadores propios. No hay notificaciones (fuera de alcance): el dueño ve sus pendientes en "Mis cargadores".
3. **Validación de reservas:** tienen que caer dentro de las franjas de disponibilidad del cargador y no pueden estar en el pasado. Si no, la API responde 400.

### D-021 · Detalles del motor no fijados por el SPEC
- **Ventana de carga:** tiene que caber entera dentro de una franja; no se admite una carga partida. La espera máxima de 120 minutos es **total**, sumando la espera por horario y la espera por reservas.
- **`horarioCarga` en las métricas:** fecha y horas locales de la carga estimada, para precargar la reserva en la pantalla de detalle. Si la carga terminara después de medianoche, se informa hasta las 23:59, porque las reservas no cruzan medianoche.
- **Modo ruta:**
  - `viajeMin` es el tiempo de origen a cargador (determina la hora de llegada) y se agrega `desvioMin`. `totalMin` = viaje + espera + carga.
  - El desvío nunca es negativo. Con distancias reales de Google podría dar un poco menos que cero.
  - El alcance se evalúa solo hasta el cargador: no se verifica que, después de cargar, se llegue al destino (sería planificar varias paradas, fuera de alcance).
- **`desglose`:** para cada criterio informa valor, valor normalizado, peso y **aporte** = 100 · peso · (1 − normalizado). La suma de los aportes es el score, lo que facilita mostrar "¿Por qué lo recomendamos?".
- **Advertencias por recomendación:** poca batería al llegar (menos del 15 %), espera por horario, espera por reserva, y en cargadores privados que la reserva queda pendiente de aprobación del dueño.
- **Compatibilidad:** se aplica literal la regla simplificada del SPEC. Por ejemplo, un vehículo CHAdeMO no usa cargadores Tipo 2, aunque en la realidad muchos tengan entrada AC.
- **Validación de la entrada:** si es inválida (batería fuera de 0–100, modo ruta sin destino), el motor lanza un error. La API valida antes con `zod`.
- **Redondeo de la salida:** distancias a 2 decimales, minutos y score a 1, costo a pesos enteros. El orden usa los valores sin redondear.

### D-022 · Interfaz del RoutingProvider
- **Decisión:** `matrix()` devuelve `{ celdas, elementosConsultados, elementosDesdeCache, advertencias }` en lugar de `Celda[][]` como dice SPEC §7.
- **Motivo:** el resultado de cada búsqueda tiene que informar la cantidad de elementos consultados (`meta`) y el aviso de caída a offline. Hacerlo con un estado compartido en el proveedor no sería seguro con solicitudes simultáneas.
- **Google:**
  - Solo se piden los orígenes y destinos que faltan en la caché, y en lotes de 625 elementos como máximo.
  - Un par sin ruta (`condition` distinta de `ROUTE_EXISTS`) se estima offline.
  - En JSON, una distancia omitida significa 0 m.

### D-023 · Geocodificación
- **Ubicación del código:** `api/src/routing/geocodificacion/`, junto a rutas.
- **Lista `static`:** 32 lugares con alcance nacional (D-001): barrios de Córdoba, localidades de los corredores y ciudades del país. Las coordenadas son aproximadas.
- **`nominatim`**, según la política de uso verificada el 27/10/2026:
  - Cola global con 1 pedido por segundo como máximo, `User-Agent` propio y caché en memoria de 24 horas.
  - **El autocompletado está prohibido:** en la Fase 5, la interfaz busca solo cuando el usuario confirma (Enter o botón), nunca mientras escribe.
  - Se apaga sin actualizar el software con `GEOCODING_PROVIDER=static`.

### D-024 · Cobertura de tests
- `npm run test:coverage -w api` mide la cobertura de `src/engine` y `src/routing`. Al cierre de la Fase 3: motor con 98.8 % de líneas y 93.9 % de ramas; proveedores con 100 % de líneas. Lo que queda sin cubrir son guardas defensivas.

### D-025 · Preselección en modo ruta por tramos (confirmada por el autor)
Ordenar por avance de **menor a mayor** vuelve a priorizar los cargadores cercanos al origen, que son el problema original: el centro de la ciudad está al comienzo de la ruta. Propuesta de implementación:
- Dividir la ruta en tantos tramos como candidatos (`CANDIDATES_LIMIT`, 8) según `ST_LineLocatePoint`.
- Tomar de cada tramo el cargador más cercano a la línea.
- Si algún tramo queda vacío, completar con los más cercanos a la línea.

Así los 8 candidatos quedan **repartidos a lo largo del recorrido** y el motor elige entre ellos por desvío, espera, carga y costo.

### D-026 · Normalización con rango mínimo por criterio (desvío del SPEC §6.5, aprobado por el autor)
- **Problema observado:** al correr el motor con el seed (Centro de Córdoba, e-208 al 15 %, urgencia alta), la min–max clásica del SPEC recomendaba un cargador AC de 11 kW con **294 minutos** de carga por encima de uno DC de 50 kW con 44 minutos. La única ventaja del primero era estar **100 m más cerca** (1.0 km contra 1.1 km). La min–max lleva cualquier diferencia, por chica que sea, a la escala completa de 0 a 1, y la distancia pesa 45 % con urgencia alta.
- **Decisión:** `norm = (x − min) / max(max − min, rangoMínimo)`. Los rangos mínimos son configurables en `engine/config.ts`: **distancia 3 km, espera 15 min, carga 30 min y costo $ 2000**. Si la diferencia real supera el umbral, el resultado es idéntico a la min–max del SPEC. Si no la supera, pesa en proporción (100 m / 3 km ≈ 0.03).
- **Efecto con el seed:** con urgencia alta pasa a ganar el cargador DC de 44 minutos (88.6 contra 80 puntos). Con urgencia media sigue ganando el AC lento y barato, por poco (75.1 contra 73.2), porque costo y carga pesan lo mismo y la diferencia de costo es grande. Con urgencia baja no cambia el ganador.
- **Impacto en el informe:** describir la normalización con rango mínimo en la sección del motor y justificar los umbrales. Son valores de diseño, no calibrados con usuarios reales: una línea de trabajo futuro es ajustarlos con datos. Los tests incluyen el caso observado, con y sin rango mínimo.

## 2026-10-27 — Fase 4

### D-027 · La preselección filtra por conectores compatibles
- **Decisión:** la consulta espacial trae solo cargadores con un conector compatible con el vehículo, y después aplica el límite de 8 candidatos. Si no hay ninguno compatible, se repite sin el filtro, para que el motor informe `SIN_COMPATIBLES` con el motivo de cada descarte.
- **Motivo:** con el seed, un Nissan Leaf en el Centro recibía 8 candidatos de los que solo 1 servía. Además, consultar rutas de cargadores incompatibles tiene costo en la Routes API sin aportar nada.
- **Impacto:** cambia el orden de SPEC §6.3, pero no la regla. La compatibilidad se sigue verificando en el motor.

### D-028 · Endpoints y respuestas agregados al SPEC §8
- **`GET /cargadores/:id`** (público): detalle con disponibilidad y ocupación de los próximos 7 días, sin datos de quién reservó. Lo necesita la pantalla "Detalle y reserva". Un cargador inactivo solo lo ven su dueño o un admin.
- **`GET /mis-cargadores/reservas`**, **`PATCH /reservas/:id/aceptar`** y **`PATCH /reservas/:id/rechazar`**: el flujo de reservas pendientes (D-020). `GET /mis-cargadores` informa `reservasPendientes`.
- **Respuesta de `POST /recomendaciones`:** además de lo definido en SPEC §6.5, incluye `vehiculo`, `modo`, `origen`, `destino`, `advertencias` globales (por ejemplo, caída a offline) y en `meta`: `candidatosEvaluados`, `distanciaPreseleccionKm`, `preseleccionAmpliada`, `elementosConsultados` y `elementosDesdeCache`.
- **`GET /cargadores`:** no se pagina, porque es para el mapa. Devuelve hasta 500 y avisa con `truncado`. Los demás listados paginan con `limit`/`offset`.

### D-029 · Reglas de reserva
- **Fecha y duración:** el inicio tiene que ser posterior a ahora y estar a 60 días como máximo. La duración va de 15 minutos a 12 horas, sin cruzar medianoche.
- **Horario:** la reserva completa tiene que caber dentro de una franja del cargador. Se reutiliza la misma función del motor.
- **Cargador:** no se puede reservar un cargador propio ni uno inactivo (409).
- **Cancelar:** quien reservó (o un admin), solo antes de que empiece.
- **Aceptar y rechazar:** el dueño del cargador (o un admin), solo si la reserva está `pendiente`.
- **Ventana de carga que cruza medianoche:** si una carga estimada termina después de medianoche, `horarioCarga` se informa hasta las 23:59 (D-021). Pasa con cargas AC largas que empiezan de noche. La reserva propuesta cubre la carga solo en parte, y queda documentado como limitación.

### D-030 · Permisos y privacidad
- **Vehículos de otro usuario:** se responde **404** (no se revela que existen).
- **Cargadores de otro dueño:** se responde **403**, porque los cargadores son públicos en el mapa. Los cargadores públicos (sin dueño) solo los edita un admin.
- **Eliminar un cargador con reservas futuras** pendientes o confirmadas: **409** con la sugerencia de desactivarlo, para no borrar reservas de otras personas.
- **Rol en modo Cognito:** `PATCH /admin/usuarios/:id` con `rol` responde 400, porque el rol lo dan los grupos del User Pool. En el listado, `rol` vale `null` en ese modo.
- **Autogestión del admin:** un admin no puede deshabilitarse ni quitarse el rol.
- **Búsquedas por texto (`ILIKE`):** escapan los comodines `%` y `_` que escriba el usuario.
- **Límites de solicitudes:** 30 por minuto por IP en `/recomendaciones` y `/geocodificar`. Detrás del balanceador hace falta configurar `trust proxy` (Fase 7, igual que D-018).

### D-031 · Seed: nombres de cargadores únicos
- Dos cargadores públicos del Centro se llamaban "Electrolinera Centro". El tipo de lugar ahora rota con un contador global, y un test verifica que no haya nombres repetidos. Cambian algunos nombres y horarios de estacionamientos respecto de los ejemplos de D-026.
