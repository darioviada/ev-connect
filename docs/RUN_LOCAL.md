# RUN_LOCAL — Cómo ejecutar la demo en tu máquina

> Este documento es un **contrato**: Claude Code debe construir el proyecto de modo que estos pasos funcionen tal cual, y verificarlo al terminar.
> No requiere cuentas de AWS ni de Google.

## Requisitos
- **Node.js** LTS (≥ 22) y npm.
- **Docker Desktop** (o Docker Engine + Compose) para la base de datos PostgreSQL con PostGIS.
- Git. Un navegador moderno.
Sin Docker: ver "Alternativas para la base de datos" más abajo.

## Opción A — Todo en contenedores (la más simple)
```bash
git clone <URL-DEL-REPOSITORIO> tfg-demo && cd tfg-demo
cp .env.example .env            # no hace falta editar nada para el modo demo
docker compose up --build
```
Abrir **http://localhost:3000**. La primera vez se crean las tablas y se cargan los datos de demostración automáticamente.
Para apagar: `Ctrl+C` y `docker compose down` (agregar `-v` para borrar también los datos).

## Opción B — Desarrollo (API y web con recarga en caliente)
```bash
npm install
cp .env.example .env
npm run db:up        # levanta solo la base de datos en Docker
npm run db:migrate   # crea tablas y extensiones
npm run db:seed      # carga catálogo, cargadores, usuarios y reservas de demostración
npm run dev          # API en http://localhost:3000 y web en http://localhost:5173
```

## Usuarios de demostración (modo local)
| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@demo.local` | `Admin123!` |
| Usuario | `usuario@demo.local` | `Usuario123!` |
También se puede crear un usuario nuevo desde "Registrarme". Sin iniciar sesión se puede buscar y obtener recomendaciones.

## Guion de demostración (≈ 5 minutos)
1. **Invitado:** en el Home elegir un vehículo del catálogo, marcar una ubicación (botón de pin o clic en el mapa), batería 45 % → ver la urgencia **Media** y la autonomía actual → "Buscar cargadores".
2. En los resultados, abrir "¿Por qué lo recomendamos?" del primer cargador (desglose del score) y pasar a la vista de mapa.
3. Repetir con batería 15 % (urgencia **Alta**) y con 85 % (urgencia **Baja**): cambia el orden de los resultados porque cambian las ponderaciones.
4. Probar un vehículo con otro conector para mostrar el filtro de compatibilidad.
5. Modo **Ruta**: origen en Córdoba y destino en Villa Carlos Paz → recomendaciones sobre el corredor con su desvío.
6. Iniciar sesión como `usuario@demo.local`: guardar un vehículo propio, reservar el cargador recomendado y verlo en "Mis reservas". Intentar reservar el mismo horario con otra cuenta → conflicto.
7. Publicar un cargador propio (clic en el mapa, conector, potencia, precio, franjas) y verlo aparecer en las búsquedas.
8. Como `admin@demo.local`: abrir `/admin` (si está implementado) y deshabilitar un usuario.
9. **Validación:** `npm run validate` y abrir `docs/validacion/resultados.md`.

## Pruebas y validación
```bash
npm test             # pruebas del motor, la API y los proveedores
npm run lint         # estilo y tipos
npm run validate -- --scenarios 200 --seed 42    # comparación contra la selección manual simulada
```

## Variables de entorno principales (ver `.env.example`)
`AUTH_MODE=local` · `ROUTING_PROVIDER=offline` · `GEOCODING_PROVIDER=static` · `DATABASE_URL` · `JWT_SECRET` · `PORT`.
Con esos valores no se usa ningún servicio externo. Para usar Cognito o la Routes API de Google ver `docs/MANUAL_TASKS.md`.

## Alternativas para la base de datos (si no se puede usar Docker)
1. **PostgreSQL nativo con PostGIS:** instalar PostgreSQL 16 y PostGIS (instaladores oficiales en Windows/macOS/Linux), crear la base `tfg` y el usuario, y ajustar `DATABASE_URL`.
2. **PostgreSQL administrado con PostGIS:** servicios de base de datos en la nube que soporten PostGIS y `btree_gist` (verificar los planes gratuitos vigentes) o **Amazon RDS** (ver `docs/AWS_DEPLOY.md`). Ajustar `DATABASE_URL` y correr `npm run db:migrate && npm run db:seed`.
En todos los casos las extensiones se crean con las migraciones: `postgis` y `btree_gist`.

## Problemas frecuentes
- *Puerto 5432 ocupado:* cambiar el puerto publicado en `docker-compose.yml` y en `DATABASE_URL`.
- *`extension "postgis" is not available`:* la base no tiene PostGIS instalado (usar la imagen `postgis/postgis`).
- *El mapa no carga:* el navegador necesita internet para los mosaicos de OpenStreetMap (la API funciona sin conexión).
- *Búsqueda de direcciones vacía:* con `GEOCODING_PROVIDER=static` solo hay una lista fija de lugares de Córdoba; usar el botón de pin o el clic en el mapa.
