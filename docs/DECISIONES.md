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
