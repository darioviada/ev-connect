# PLAN — Fases de construcción

Trabajá **una fase por vez**. Al cerrar cada una: tests verdes, `npm run lint` sin errores, commit, resumen breve y **esperá confirmación**.
Prioridades de `docs/SPEC.md`: P0 imprescindible · P1 importante · P2 deseable. Si el tiempo no alcanza, se recorta de abajo hacia arriba (P2 primero).

## Fase 0 — Andamiaje (P0)
- Monorepo con npm workspaces (`api`, `web`), TypeScript estricto, ESLint + Prettier, `vitest`.
- `docker-compose.yml` con el servicio `db` (`postgis/postgis:16-3.4`, volumen persistente, healthcheck). `.env.example`, `.gitignore`.
- `api`: servidor Express mínimo con `GET /api/v1/salud`, configuración tipada desde variables de entorno (falla con mensaje claro si falta algo).
- `web`: Vite + React + TS con página vacía y fuentes `@fontsource`.
- Scripts: `db:up`, `db:migrate`, `db:seed`, `dev`, `test`, `lint`, `build`.
**Aceptación:** `npm run db:up && npm run dev` levanta DB, API (`/salud` responde) y web.

## Fase 1 — Base de datos y seed (P0)
- Migraciones de Knex con el esquema de la sección 5 de SPEC (más `migrations_dev/` para `dev_credencial`). Verificar que PostGIS y `btree_gist` se creen.
- Seed determinístico de la sección 11 (catálogo, ~60 cargadores con franjas, usuarios de demo, algunas reservas). Idempotente y con `--reset`.
- Tests: constraint de solape de reservas (dos reservas solapadas → error), `CHECK` de cargadores privados sin dueño.
**Aceptación:** `npm run db:migrate && npm run db:seed` deja la base poblada; los tests de constraints pasan.

## Fase 2 — Autenticación y autorización (P0)
- Interfaz `AuthProvider` con `LocalAuthProvider` (registro/login, JWT HS256, `dev_credencial`) y `CognitoAuthProvider` (`aws-jwt-verify`, ID token).
- Middlewares `autenticar`, `requerirRol`, `esDuenoOAdmin`; `GET /yo` con *upsert* de usuario; chequeo de `activo`.
- Tests de la matriz de permisos con tokens locales. El modo Cognito se prueba con el verificador simulado (no hace falta cuenta AWS).
**Aceptación:** login local funciona; rutas protegidas devuelven 401/403 correctamente; el código del modo Cognito compila y tiene tests con mocks.

## Fase 3 — Motor de recomendación (P0) ← el núcleo
- `engine/` puro según SPEC §6: urgencia, filtros, estimaciones, scoring WSM, pesos en `config.ts`, interfaz `ScoringStrategy`.
- `RoutingProvider` (Offline y Google con caché y fallback) según SPEC §7. Geocodificación `static` (y `nominatim` P1).
- Tests unitarios exhaustivos (SPEC §13) **antes** de conectar con la API.
**Aceptación:** todos los tests del motor pasan; cobertura alta del directorio `engine/`; el Google provider se prueba con `fetch` simulado.

## Fase 4 — API REST (P0 → P1 → P2)
- P0: catálogo, vehículos propios, `GET /cargadores`, `POST /recomendaciones` (preselección espacial + motor), reservas (con 409 por solape) y mis reservas.
- P1: publicar/gestionar cargadores y disponibilidad, favoritos y rutas guardadas, geocodificación.
- P2: endpoints `/admin/*`.
- Validación con `zod`, errores con el formato del CLAUDE.md, rate limiting, `helmet`, CORS.
**Aceptación:** tests de integración sobre base real; flujo completo con `curl`: login → recomendar → reservar → conflicto 409.

## Fase 5 — Frontend (P0 → P1 → P2)
- Sistema de diseño (tokens, componentes base), layout móvil + escritorio, navegación inferior/superior, rutas protegidas.
- P0: `/inicio`, `/login`, **Home buscador** (vehículo, chips, ubicación/ruta, slider de batería con urgencia y autonomía actual), resultados (lista y mapa), detalle y reserva, mis vehículos y agregar vehículo, mis reservas.
- P1: publicar/mis cargadores, favoritos y rutas guardadas, "¿Por qué lo recomendamos?" (desglose del score).
- P2: pantalla `/admin`, pruebas E2E.
- Modo Cognito en el frontend con Amplify detrás de una interfaz (sin romper el modo local).
**Aceptación:** recorrer en el navegador el guion de demo de `docs/RUN_LOCAL.md`; capturas de pantalla de cada vista guardadas en `docs/capturas/`.

## Fase 6 — Validación del motor (P0)
- `npm run validate` según SPEC §12; genera `docs/validacion/resultados.csv` y `resultados.md`.
- Revisar con el autor los resultados **antes** de usarlos en el informe.
**Aceptación:** el script corre de punta a punta, es reproducible con la misma semilla y reporta limitaciones.

## Fase 7 — Empaquetado y documentación (P0)
- `api/Dockerfile` multi-stage (compila `web/` y lo sirve desde la API), `docker compose up --build` levanta todo (DB + migración + seed automáticos).
- `README.md` raíz y `docs/RUN_LOCAL.md` verificados en una máquina limpia (clonar, seguir los pasos, que funcione).
- Actualizar `docs/DECISIONES.md` y la lista de diferencias respecto del informe (SPEC §15).
**Aceptación:** alguien que no vio el proyecto lo levanta en menos de 10 minutos siguiendo solo `RUN_LOCAL.md`.

## Prompt sugerido para empezar (lo pega el autor)
> Leé `CLAUDE.md` y luego `docs/SPEC.md` y `docs/PLAN.md`. Antes de escribir código, resumime en 10 líneas cómo entendiste el proyecto,
> listame las dudas o contradicciones que encuentres y proponé el plan detallado de la Fase 0. Esperá mi confirmación para empezar.
