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
