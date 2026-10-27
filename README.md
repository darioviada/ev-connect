# EVConnect — Recomendación de puntos de carga para vehículos eléctricos

Demo funcional del Trabajo Final de Graduación (Ingeniería en Software): un sistema que recomienda el punto de carga más
conveniente para un vehículo eléctrico sobre una red colaborativa de cargadores públicos y privados en Argentina
(zona piloto del seed: Córdoba).

> **Estado:** en construcción (Fase 5: API y frontend completos; faltan validación y empaquetado). Capturas en `docs/capturas/`. Ver `docs/PLAN.md`.
>
> **Datos de demostración:** todos los datos de la demo (cargadores, precios, ubicaciones, usuarios, reservas) son
> **sintéticos**. Las especificaciones de los vehículos son aproximadas.

## Cómo ejecutarlo

Ver **[`docs/RUN_LOCAL.md`](docs/RUN_LOCAL.md)**. Resumen (modo desarrollo, requiere Node.js ≥ 22 y Docker):

```bash
npm install
cp .env.example .env
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev        # API en http://localhost:3000 · web en http://localhost:5173
```

No hace falta ninguna cuenta externa: por defecto `AUTH_MODE=local` y `ROUTING_PROVIDER=offline`.

## Estructura

| Carpeta | Contenido                                                                   |
| ------- | --------------------------------------------------------------------------- |
| `api/`  | API REST (Express + TypeScript), motor de recomendación, migraciones y seed |
| `web/`  | Frontend (Vite + React + TypeScript)                                        |
| `docs/` | Especificación, plan, guías de ejecución y despliegue, decisiones, mockups  |

## Comandos

| Comando                     | Qué hace                                                                                            |
| --------------------------- | --------------------------------------------------------------------------------------------------- |
| `npm run db:up` / `db:down` | Levanta / apaga PostgreSQL + PostGIS en Docker                                                      |
| `npm run db:migrate`        | Aplica las migraciones                                                                              |
| `npm run db:seed`           | Carga los datos de demostración (`-- --reset` para limpiar y volver a cargar)                       |
| `npm run dev`               | API y web con recarga en caliente                                                                   |
| `npm test`                  | Pruebas de la API y de la web (requiere la base levantada: `npm run db:up`)                         |
| `npm run lint`              | ESLint, Prettier y verificación de tipos                                                            |
| `npm run build`             | Compila la web y la API                                                                             |
| `npm run capturas -w web`   | Recorre el guion de demo en Chromium y guarda capturas en `docs/capturas/` (requiere `npm run dev`) |

## Documentación

- [`docs/SPEC.md`](docs/SPEC.md): especificación (fuente de verdad)
- [`docs/PLAN.md`](docs/PLAN.md): fases de construcción
- [`docs/DECISIONES.md`](docs/DECISIONES.md): desvíos y decisiones de implementación
- [`docs/AWS_DEPLOY.md`](docs/AWS_DEPLOY.md): despliegue futuro en AWS
