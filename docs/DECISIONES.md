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

## 2026-10-27 — Fase 5

### D-032 · Colores ajustados por contraste (aprobado por el autor)
Para cumplir un contraste de al menos 4.5:1 en texto normal (WCAG AA), cuatro tokens se oscurecieron levemente respecto de SPEC §10.1:

| Token | SPEC | Usado | Contraste |
|---|---|---|---|
| Primario | `#0F9D6B` | `#0C7F57` | Texto blanco encima: 5.01:1 |
| Atenuado | `#9A9D93` | `#6E7069` | Sobre fondo y sobre blanco: 4.6:1 o más |
| Pendiente | `#B36B00` | `#A36100` | Sobre su fondo: 4.62:1 |
| Error / favorito | `#D4534E` | `#BC4945` | 5.03:1 |

El resto de los tokens no cambia. Están en `web/src/styles/tokens.css`.

### D-033 · Decisiones del frontend
- **Estado de la búsqueda en la URL** (`?b=` con el pedido en base64url). Sobrevive a ir al detalle y volver, a recargar la página y a compartir el enlace. El resultado queda en la caché de TanStack Query, así que volver no repite la consulta. El formulario del Home se recuerda en `sessionStorage`.
- **Primera visita:** sin sesión se muestra `/inicio`. "Continuar como invitado" se recuerda en la pestaña (`sessionStorage`).
- **Sesión local:** el JWT se guarda en `localStorage` (solo modo demo). En modo Cognito los tokens los maneja Amplify, que se carga por demanda (`import()`): en modo local no se descarga.
- **Geocodificación sin autocompletado** (política de Nominatim, D-023): busca recién con Enter o con el botón de buscar.
- **Elegir en el mapa:** el mapa (Leaflet) se carga recién al abrirlo. La vista de resultados en mapa también se carga por demanda.
- **Línea de la ruta:** en el mapa es recta, porque el proveedor offline no calcula el trazado (SPEC §10.2).
- **Rutas guardadas:** se nombran "Origen → Destino" para recuperar las etiquetas al reutilizarlas desde el buscador o desde Favoritos.
- **Diferencias con los mockups:**
  - No hay foto del auto en "Detalle del vehículo": no hay imágenes con licencia, se usa un ícono.
  - No hay "¿Olvidaste tu contraseña?": en modo local no hay envío de correos. En modo Cognito podría agregarse con Amplify (fuera del alcance de la demo).
  - En móvil el fondo es blanco y en escritorio gris con tarjetas blancas, como en los mockups.
  - Los horarios iguales se agrupan ("Todos los días", "Lunes a viernes").
- **Rutas agregadas a las de SPEC §10.2:**
  - `/vehiculos/:id/editar`, `/mis-cargadores` y `/mis-cargadores/:id/editar`.
  - `/mis-cargadores` es la gestión de los cargadores propios y de las reservas recibidas (aceptar o rechazar, D-020).
- **Administración (P2):** la moderación lista solo cargadores activos, porque `GET /cargadores` no devuelve los inactivos. Un cargador desactivado por un admin lo reactiva su dueño (o un admin desde la API). Es una limitación aceptada para la P2.
- **Capturas:** `npm run capturas -w web` recorre el guion de demo con Playwright (Chromium) y guarda 18 capturas en `docs/capturas/`. Es una herramienta de documentación, no una suite E2E (las pruebas E2E siguen como P2 opcional).
- **Tamaño del bundle:** el paquete principal pesa unos 620 kB (180 kB comprimido), y Vite avisa porque supera los 500 kB. Leaflet y Amplify ya van en paquetes separados. No afecta a la demo; podría dividirse más por ruta si hiciera falta.

## 2026-10-28 — Trazado real de la ruta en el mapa (pedido del autor, opción a)

### D-034 · Trazado por calles con `computeRoutes` cuando el proveedor es Google
- **Motivo:** `computeRouteMatrix` solo devuelve distancias y tiempos. Para dibujar el camino real hace falta `computeRoutes` con el trazado (*Encoded Polyline*). SPEC §10.2 prevé "línea recta en offline", es decir, el camino real cuando hay un proveedor que lo calcula.
- **Implementación:**
  - `RoutingProvider.trazado(origen, destino)`: el proveedor offline devuelve `null` y el de Google consulta `POST https://routes.googleapis.com/directions/v2:computeRoutes`.
  - *Field mask* mínimo: `routes.polyline.encodedPolyline,routes.distanceMeters,routes.duration`.
  - Sin tráfico (`TRAFFIC_UNAWARE`), sin paradas intermedias, `polylineQuality: OVERVIEW` y `polylineEncoding: ENCODED_POLYLINE`.
  - Verificado en la documentación oficial (28/10/2026). Así el pedido queda en la categoría **Essentials**, y pedir el trazado no cambia de categoría. El cupo gratuito mensual hay que confirmarlo en la lista de precios vigente.
  - **Un pedido por búsqueda en modo ruta** (origen → destino), con **caché de 7 días** en la tabla nueva `cache_trazado`. El modo ubicación no lo usa.
  - Si Google falla o no hay ruta por calles, se devuelve `null` y la interfaz dibuja la recta. No afecta la recomendación.
  - La respuesta de `POST /recomendaciones` agrega `trazado: { puntos: [[lat, lng], …], distanciaKm, duracionMin, fuente } | null`. El decodificador del formato de Google está en `api/src/routing/polyline.ts` y se prueba con el ejemplo oficial.
  - En el mapa, una leyenda indica si se muestra el recorrido por calles (Google, sin tráfico) o una línea recta (offline).
- **Impacto en el informe (SPEC §15):** agregar la tabla de infraestructura `cache_trazado` junto a `cache_ruta`, y en el análisis de costos un pedido de *Compute Routes Essentials* por búsqueda en modo ruta (menos lo que resuelva la caché).

### D-035 · Consumo de la Routes API durante la verificación y protección agregada
- **Qué pasó (28/10/2026):** el autor configuró `GOOGLE_MAPS_API_KEY` en `.env` (con `ROUTING_PROVIDER=auto`). Al reiniciar `npm run dev`, la API pasó a usar Google, y el script de capturas hizo dos búsquedas reales: **25 elementos de `computeRouteMatrix` y 1 pedido de `computeRoutes`**, según el log de la API.
- Sirvió como prueba de punta a punta con Google: el mapa dibujó el recorrido real Córdoba → Villa Carlos Paz (41,7 km, ~44 min). Las capturas 04, 05, 15 y 16 de esa corrida usan distancias de Google.
- **Protección:** `npm run capturas -w web` ahora se niega a correr si el `.env` tiene una clave de Google y el proveedor no es `offline`, salvo `CAPTURAS_PERMITIR_GOOGLE=1`.
- **Para la Fase 6:** `npm run validate` va a usar el proveedor **offline por defecto**, aunque haya clave, y Google solo con una opción explícita. Cientos de escenarios con Google tendrían un costo que hay que decidir a conciencia.

## 2026-10-28 — Fase 6

### D-036 · Diseño de `npm run validate`
- **Mismo camino que la API:** la lógica de `POST /recomendaciones` se extrajo a `api/src/modules/recomendaciones/servicio.ts`, que usan la API y la validación.
- **Base propia y reproducible:** `<base>_validacion`, sembrada con fecha fija (`FECHA_BASE` = 02/11/2026). Los escenarios caen en esa semana, así que el resultado no depende del día en que se corra. Se verificó que dos corridas con la misma semilla producen archivos idénticos.
- **Proveedor offline por defecto** (D-035). Con `--proveedor google` exige además `--confirmar-costo`.
- **Línea base:** entre **todos** los cargadores activos, el factible (compatible, alcanzable y disponible) más cercano. En modo ruta, el de **menor desvío**. Se le supone información perfecta, un supuesto favorable a la base.
- **Grado de optimalidad:** resuelve la duda 6 de la primera ronda. Se calcula como score(sistema) / score(óptimo), con **ambos puntajes en el conjunto completo** (fuerza bruta), porque los puntajes min–max de conjuntos distintos no son comparables. Mide la pérdida por la preselección.
- **Métrica de cercanía:** el informe agrega la cercanía (distancia en modo ubicación, desvío en modo ruta), que es el criterio de la base. La primera versión promediaba la "distancia al cargador" de los dos modos y mostraba una mejora del 15 % que era un efecto de la mezcla: en modo ruta la base minimiza el desvío, no la distancia al origen. Se verificó que el sistema nunca supera a la base en cercanía (0 de 145 casos en ubicación y 0 de 40 en ruta), como corresponde por definición.
- **Valores absolutos:** las tablas por grupo los muestran junto a los porcentajes, porque con promedios chicos (desvíos menores a 1 km) el porcentaje exagera.

### D-037 · Sensibilidad de los resultados a la semilla (200 escenarios cada una, proveedor offline)
Valores tal como los imprime `npm run validate` (mejora = (base − sistema) / base; negativo = el sistema es peor):

| Semilla | Comparables | Cercanía | Tiempo total | Costo | Elige distinto que la base | Optimalidad prom. | Sin solución por preselección |
|---|---:|---:|---:|---:|---:|---:|---:|
| 42 (oficial) | 185 | −12,1 % | +9,1 % | +0,6 % | 34,6 % | 97,9 % | 1 |
| 1 | 187 | −7,6 % | +10,0 % | −1,9 % | 29,9 % | 97,8 % | 3 |
| 7 | 184 | −9,9 % | +6,3 % | −0,9 % | 31,0 % | 98,2 % | 2 |
| 2026 | 190 | −6,2 % | +11,1 % | −2,2 % | 32,1 % | 97,9 % | 1 |
| 99 | 186 | −9,9 % | +4,4 % | +3,0 % | 34,9 % | 97,9 % | 2 |

**Lectura:**
- **Tiempo total:** la mejora es consistente (entre +4 % y +11 %).
- **Cercanía:** siempre se cede algo (entre 6 % y 12 %), como corresponde por definición.
- **Costo:** **en el total no hay una mejora consistente** (entre −2,2 % y +3,0 %). La mejora en costo aparece solo con urgencia baja, donde el costo pesa 50 %; con urgencia alta el costo empeora.
- **Optimalidad:** se mantiene cerca del 98 %.

Hay que informar estos resultados tal como salen, con la semilla y la cantidad de escenarios.

## 2026-10-28 — Fase 7

### D-038 · Imagen y contenedores
- **`api/Dockerfile` multi-etapa sobre `node:24-alpine`:**
  - La etapa de build compila la web (las `VITE_*` entran como *build args*) y la API.
  - La etapa final instala solo las dependencias de producción de la API, corre como usuario `node` (no root), expone el puerto 3000 y tiene *healthcheck* sobre `/api/v1/salud`. Pesa 281 MB.
  - En la imagen, `npm run db:migrate` y `npm run db:seed` usan el código compilado (sin `tsx`), así la tarea única de migración de ECS funciona como dice AWS_DEPLOY §4.5.
- **La API sirve la web** cuando existe `WEB_DIST` (la imagen la define). Los archivos de `/assets` llevan caché larga y cualquier otro GET que no sea de `/api` devuelve `index.html`.
- **CSP (helmet):**
  - Permite los mosaicos de `tile.openstreetmap.org`, la conexión a `*.amazonaws.com` (Cognito) y estilos en línea (Leaflet/React).
  - Desactiva `upgrade-insecure-requests`, porque la demo corre por http://localhost; en la nube el https lo da el balanceador.
  - Verificado en el navegador: sin errores de consola ni bloqueos.
- **`TRUST_PROXY`:** cuántos proxies son confiables. Va en 1 detrás del ALB, para que los límites de solicitudes usen la IP real. Cierra el pendiente de D-018 y D-030; está agregado en AWS_DEPLOY §6.2.
- **`JWT_SECRET` en el contenedor** (cierra D-003): con `AUTH_MODE=local`, si falta o es el de demostración, `docker-entrypoint.sh` genera uno aleatorio por contenedor. `docker compose up` funciona sin editar nada y nunca se usa en producción un secreto conocido. Al reiniciar el contenedor hay que volver a iniciar sesión.
- **Comandos de base con configuración mínima:** `db:migrate` y `db:seed` validan solo `DATABASE_URL`, `AUTH_MODE` y `TZ`. Así funcionan con `docker exec` y en la tarea de migración de ECS, sin secretos ni variables de Cognito.
- **`docker compose up --build`:** la app espera a que la base esté sana, migra y siembra solo si la base está vacía (`seed --si-vacia`). Los puertos son configurables (`DB_PORT`, `APP_PORT`), y lee el `.env` si existe.

### D-039 · Verificación en una copia limpia (28/10/2026)
- **Opción A (contenedores):** se clonó el repositorio en una carpeta nueva, se copió `.env.example` a `.env` y se corrió `docker compose -p evprueba up --build` con otros puertos. Quedó sano en **82 s**, con imagen construida, migraciones y seed.
  - Con Playwright se recorrió búsqueda, resultados, mapa con mosaicos, login y reservas, sin errores de consola ni de CSP.
  - Se probó el reinicio (no vuelve a sembrar) y `npm run db:migrate` dentro de la imagen. Al final se borró el entorno de prueba.
- **Opción B (desarrollo):** en la misma copia, `npm install` tardó 26 s; lint sin errores; **357 tests en verde**; build correcto. Unos 100 s en total.
- **Pendiente para el autor:** verificarlo en otra computadora (MANUAL_TASKS H). Docker Desktop tiene que estar en ejecución.
- **Sin verificar:** la imagen `postgis/postgis:16-3.4` en Mac con procesador Apple Silicon. Si no hubiera variante arm64, Docker la ejecuta emulada y anda, pero más lento.

### D-040 · Licencias
- Ver `docs/LICENCIAS.md`. **react-leaflet usa la Hippocratic License 2.1** (licencia "ética", no aprobada por la OSI). El uso académico no la contradice, pero conviene mencionarlo; la alternativa es usar Leaflet (BSD-2-Clause) sin el envoltorio de React.

## Resumen: diferencias con el diseño del informe (para actualizar el DER, el diagrama de clases y el diccionario de datos)

**Modelo de datos** (SPEC §15 y lo agregado durante la construcción):
1. `cargador.precio_kwh`, `cargador.nombre` y `cargador.direccion`.
2. `vehiculo_modelo` y `vehiculo_usuario`: `potencia_max_ac` y `potencia_max_dc`.
3. `usuario.activo`.
4. `reserva.rango` (columna generada) y la restricción `EXCLUDE` contra solapes. La reserva `pendiente` significa "esperando aprobación del dueño del cargador" (D-020) y también bloquea el horario.
5. Tablas de infraestructura: `cache_ruta` (distancias) y **`cache_trazado`** (recorridos de Google, D-034). `dev_credencial` existe solo en modo local.
6. Vista `vehiculo_usuario_detalle` e índices en claves foráneas (D-010).

**Comportamiento y diseño:**
7. **Alcance nacional** con piloto en Córdoba (D-001).
8. **Preselección espacial:**
   - solo conectores compatibles (D-027);
   - en modo ruta, repartida por tramos a lo largo del recorrido (D-025);
   - proveedor de rutas con caché (mitigación del riesgo R4).
9. **Normalización min–max con rango mínimo por criterio** (D-026): es un desvío respecto de la min–max pura.
10. **Flujo de aprobación de reservas en cargadores privados:** aceptar o rechazar, con endpoints nuevos (D-020 y D-028).
11. **Reglas de reserva** (D-029): dentro del horario del cargador, no en el pasado, de 15 min a 12 h y hasta 60 días de anticipación.
12. **Trazado real de la ruta** con `computeRoutes` cuando el proveedor es Google (D-034): agrega un pedido de *Compute Routes Essentials* por búsqueda en modo ruta al análisis de costos.
13. **Tokens de color** ajustados por contraste WCAG AA (D-032).
14. **Arquitectura de despliegue:** una sola imagen que sirve API y web, sin S3 ni CloudFront (D-038; coincide con MANUAL_TASKS F).
15. **Validación:** método y resultados en D-036 y D-037, y en `docs/validacion/resultados.md`. Copiar al informe **solo** esos números, con la semilla y la cantidad de escenarios.

## 2026-11-06 — Búsqueda de direcciones exactas (pedido del autor)

### D-041 · Nominatim como geocodificador por defecto y búsqueda en dos pasos
- **Problema:** el buscador decía "Dirección o barrio", pero con `GEOCODING_PROVIDER=static` solo reconoce una lista fija de barrios y ciudades: las direcciones no se encontraban.
- **Decisión del autor:** usar Nominatim, que ya estaba implementado y es gratuito y sin cuenta. Queda como **valor por defecto en `.env.example`**. Es un desvío de SPEC §4.3: con `static` la demo no usa ningún servicio externo; con Nominatim requiere internet, como ya lo requerían los mosaicos del mapa.
- **Mejoras para direcciones** (verificadas en la documentación oficial el 06/11/2026 y con consultas reales):
  - **Detalle de la dirección:** se pide `addressdetails=1` para mostrar "Avenida Colón 1234" y no solo "1234".
  - **Búsqueda en dos pasos:** primero solo cerca de un punto de referencia (`viewbox` de unos 16 km con `bounded=1`) y, si no hay resultados, en todo el país. Solo con prioridad (`bounded=0`), "General Paz 100" devolvía otras localidades en lugar de la avenida de Córdoba capital.
  - **Punto de referencia:** el punto ya elegido, el origen (al buscar el destino) o el centro del mapa.
  - **Abreviaturas:** se expanden las que Nominatim no reconoce ("Bv" → "Bulevar", "Gral" → "General", "Pje" → "Pasaje", "Pte" → "Presidente").
  - **Precisión:** si se pidió una altura y OpenStreetMap no tiene la numeración, el resultado se marca como "Ubicación aproximada (calle)".
- **Respaldo:** si Nominatim no responde, la API usa la lista fija y devuelve un `aviso` (antes respondía 503).
- **Interfaz:** `GET /api/v1/configuracion` (público, sin secretos) informa los proveedores activos. Con eso, el campo dice "Calle y número, barrio o ciudad" (Nominatim) o "Barrio o ciudad" (lista fija), con mensajes específicos cuando no hay resultados y la atribución de OpenStreetMap junto a los resultados.
- **Política de uso:** se mantiene: 1 pedido por segundo (los dos pasos también), `User-Agent` propio, caché de 24 horas y búsqueda solo al confirmar (sin autocompletado). Para apagarlo, `GEOCODING_PROVIDER=static`.
- **Limitación:** la precisión depende de los datos de OpenStreetMap. Hay calles sin numeración cargada, y para otras ciudades conviene escribir la ciudad ("San Martín 100, Rosario").

## 2026-11-06 — El mapa como vista principal de resultados (pedido del autor)

### D-042 · Después de buscar se muestra el mapa
- **Decisión:** al buscar se abre `/resultados/mapa`. La lista (`/resultados`) queda a un toque con el botón de lista. Las rutas de SPEC §10.2 no cambian; solo cuál se muestra primero.
- **Motivo:** el mapa ayuda a orientarse y es la información principal de una búsqueda de cargadores. Funciona bien en móvil (hoja inferior) y en escritorio (panel lateral).
- **Cambios:**
  - La hoja del mapa incorpora todo lo que antes solo tenía la lista: resumen (vehículo, batería, urgencia y autonomía), avisos, "Guardar esta ruta", motivo cuando no hay resultados y cargadores descartados. Son componentes compartidos (`components/Resultados/InfoBusqueda.tsx`).
  - "Volver" desde el detalle regresa a la vista de la que se vino. Si se entró por un enlace directo, va al mapa.
  - Cambiar entre mapa y lista reemplaza la entrada del historial, para no acumular idas y vueltas.
  - Título de página para lectores de pantalla en la vista de mapa.
  - En escritorio, la barra flotante va solo sobre el mapa.
  - Los controles de zoom quedan por encima del aviso de datos sintéticos.
- **Capturas:** el script recorre el nuevo flujo (`04-resultados-mapa`, `05-resultados-lista`, `15-ruta-mapa`, `16-resultados-ruta-lista` y `17b-ruta-mapa-escritorio`).

### D-043 · Ajuste de la búsqueda de lugares (complementa D-041)
- La búsqueda **local acotada** (`bounded=1`) se usa solo cuando lo escrito tiene un número, es decir, una dirección.
- Para barrios y ciudades se busca en todo el país, **priorizando** lo cercano (`bounded=0`). Con la búsqueda local, "Villa Carlos Paz" devolvía primero la calle "Variante Carlos Paz" de Córdoba.
- Verificado con consultas reales:
  - "Villa Carlos Paz" devuelve la ciudad y "Nueva Córdoba" el barrio.
  - "Colón 1234" devuelve Avenida Colón 1234 de Córdoba.
  - "General Paz 100" devuelve la de Córdoba capital.
