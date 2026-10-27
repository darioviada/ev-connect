# CLAUDE.md — Demo del sistema de recomendación de puntos de carga EV (TFG)

## Contexto
Este repositorio contiene la **demo funcional** de un Trabajo Final de Graduación (Ingeniería en Software):
un sistema que recomienda, de forma optimizada, el punto de carga más conveniente para un vehículo eléctrico,
sobre una red colaborativa de cargadores públicos y privados (Argentina, zona piloto: Córdoba).
El núcleo del proyecto es el **motor de recomendación** (scoring multicriterio). El marketplace (publicar y reservar
cargadores) es la capa de datos que lo alimenta.

La demo puede ser ejecutada por el profesor en su máquina, **sin cuentas externas** (ni AWS ni Google).

## Documentos (leelos en este orden)
1. `docs/SPEC.md` — fuente de verdad: alcance, modelo de datos, motor, API, pantallas, seed, validación.
2. `docs/PLAN.md` — fases de construcción y criterios de aceptación. Trabajá fase por fase.
3. `docs/RUN_LOCAL.md` — contrato de ejecución: esos comandos deben funcionar tal cual al terminar.
4. `docs/MANUAL_TASKS.md` — tareas que hace el autor a mano (cuentas, claves). No las intentes automatizar.
5. `docs/AWS_DEPLOY.md` — despliegue futuro. **No lo ejecutes**; solo mantené el código compatible (Dockerfile, variables de entorno).

## Reglas de trabajo
1. Antes de escribir código de una fase, leé la sección correspondiente de `docs/SPEC.md` y proponé un plan breve.
2. Si algo es ambiguo o se contradice, **preguntá**. Si decidís desviarte del SPEC, registralo en `docs/DECISIONES.md` (fecha, motivo, impacto).
3. Para APIs y librerías de terceros (Google Routes API, Cognito, Amplify, aws-jwt-verify, Leaflet, Nominatim, Knex, etc.)
   **verificá la documentación oficial vigente** antes de implementar. No confíes en la memoria para nombres de endpoints, campos o versiones.
4. **No inventes resultados.** Las métricas de validación salen únicamente de `npm run validate`. Si el sistema pierde frente a la línea base en algún escenario, se reporta.
5. Los datos de seed son **sintéticos**: dejalo escrito en el seed, en la UI (aviso discreto) y en el README. Las especificaciones de vehículos son aproximadas y deben marcarse como tales.
6. **Secretos**: nunca en el repositorio. Mantené `.env.example` con placeholders y `.gitignore` con `.env*` (excepto el example).
7. **No crees ni toques recursos de AWS/Google ni ejecutes nada que requiera credenciales o cobre dinero.** El código debe funcionar con `AUTH_MODE=local` y `ROUTING_PROVIDER=offline`.
8. Mantené el alcance: no agregues funcionalidades fuera de `docs/SPEC.md` (sin pagos, sin calificaciones, sin notificaciones, sin múltiples paradas de carga).
9. Commits pequeños y convencionales (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). Al cerrar una fase: tests verdes, lint sin errores, resumen de lo hecho y **esperá confirmación** antes de seguir.

## Stack
- Node.js LTS (≥ 22), TypeScript estricto, npm workspaces (monorepo: `api/` y `web/`).
- API: Express, `zod` (validación), `knex` + `pg` (migraciones y SQL; consultas espaciales con SQL crudo parametrizado), `pino` (logs), `helmet`, `cors`, `express-rate-limit`.
- Auth: `aws-jwt-verify` (modo Cognito) y `jsonwebtoken` + `bcryptjs` (modo local, solo desarrollo).
- DB: PostgreSQL 16 + PostGIS 3.4 (imagen `postgis/postgis:16-3.4`) y extensión `btree_gist`.
- Web: Vite + React + TypeScript, React Router, TanStack Query, `react-leaflet` + OpenStreetMap, `aws-amplify` (Auth, solo modo Cognito),
  fuentes con `@fontsource/sora` y `@fontsource/plus-jakarta-sans` (funciona offline). CSS Modules + variables CSS; sin kit de UI.
- Tests: `vitest` (+ `supertest` para la API). E2E con Playwright es opcional (fase P2).
- Contenedores: `docker compose` para DB (y opcionalmente todo); `api/Dockerfile` multi-stage que también sirve el build de `web/` (un solo contenedor en producción).

## Estructura esperada
```
/
├─ CLAUDE.md  README.md  docker-compose.yml  .env.example  package.json (workspaces)
├─ api/
│  ├─ src/ { config, db, auth, routing, engine, modules/*, middleware, app.ts, server.ts }
│  ├─ migrations/  migrations_dev/ (solo modo local)  seeds/
│  ├─ scripts/validate.ts   tests/   Dockerfile
├─ web/
│  └─ src/ { pages, components, api, auth, hooks, styles }
└─ docs/ { SPEC.md PLAN.md RUN_LOCAL.md MANUAL_TASKS.md AWS_DEPLOY.md DECISIONES.md mockups/ validacion/ }
```

## Comandos que deben existir (ver `docs/RUN_LOCAL.md`)
`npm install` · `npm run db:up` · `npm run db:migrate` · `npm run db:seed` · `npm run dev` · `npm test` · `npm run lint` ·
`npm run validate` · `npm run build` · `docker compose up --build`

## Convenciones
- Idioma de la UI: español rioplatense (es-AR). Entidades de dominio en español (`Cargador`, `Reserva`, `VehiculoModelo`),
  vocabulario técnico en inglés (`service`, `provider`, `middleware`). Comentarios breves en español.
- Tablas y columnas en `snake_case` español, tal como el DER de `docs/SPEC.md`. JSON de la API en `camelCase`.
- Errores de la API: `{ "error": { "code": "STRING", "message": "texto", "details": {} } }`.
- Todo SQL parametrizado. Nunca concatenes entradas del usuario en consultas.
- El motor de recomendación (`api/src/engine`) es **puro** (sin I/O): recibe datos, devuelve resultados. Eso permite testearlo y reutilizarlo en `validate`.
- Accesibilidad básica: `label` asociado a cada input, foco visible, contraste suficiente, botones con `aria-label` si solo tienen ícono.
