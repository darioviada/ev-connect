# SPEC — Sistema de recomendación optimizada de puntos de carga para vehículos eléctricos

> Documento fuente de verdad para la demo. Deriva del informe del TFG (entregas 1 a 3).
> Prioridades: **P0** = imprescindible para la demo · **P1** = importante · **P2** = deseable.

## 1. Objetivo y alcance

**Objetivo general.** Desarrollar un sistema de recomendación y optimización que, a partir de una red colaborativa de cargadores
públicos y privados, sugiera al usuario el punto de carga más conveniente considerando ubicación, autonomía del vehículo, tipo de
conector, disponibilidad, tiempo de espera y costo, reduciendo el tiempo y la distancia promedio que insume la selección manual.

**Objetivo del prototipo.** Recomendar de forma automática el punto de carga más conveniente para un usuario de vehículo eléctrico,
ponderando su ubicación o ruta, la autonomía del vehículo y las variables de conector, disponibilidad, tiempo de carga y costo de los
cargadores públicos y privados publicados en la red colaborativa.

**Límite.** Desde que el usuario se registra, publica un cargador o ingresa los parámetros de búsqueda, hasta que el sistema devuelve
el listado ordenado de cargadores recomendados y el usuario confirma la reserva del elegido.

**Alcances (procesos incluidos).** Autenticación y gestión de usuarios · Administración de vehículos del usuario ·
Publicación y uso de cargadores privados · Consulta de la red colaborativa de cargadores públicos y privados ·
Recomendación de puntos de carga · Reserva de cargadores · Gestión de favoritos y rutas guardadas.

**Fuera de alcance:** pagos, calificaciones, notificaciones, ocupación en tiempo real por IoT, planificación de múltiples paradas,
integración con redes reales de cargadores, app nativa.

## 2. Roles y permisos
El rol sale del token (grupos de Cognito `user` / `admin`). Quien no tiene grupo se trata como `user`. Sin sesión = invitado.

| Funcionalidad | Invitado | user | admin | Prioridad |
|---|---|---|---|---|
| Buscar y obtener recomendaciones (vehículo del catálogo) | Sí | Sí | Sí | P0 |
| Cargar y usar vehículos propios | No | Sí | Sí | P0 |
| Reservar un cargador | No | Sí | Sí | P0 |
| Publicar y administrar cargadores propios | No | Sí (solo propios) | Sí | P1 |
| Guardar favoritos y rutas | No | Sí | Sí | P1 |
| Gestionar perfiles (habilitar/deshabilitar usuarios, asignar rol) | No | No | Sí | P2 |
| Modificar o dar de baja cargadores de otros | No | No | Sí | P2 |
| Administrar el catálogo de modelos de vehículos | No | No | Sí | P2 |

Regla de autorización: se verifica **siempre en el backend** (middleware), nunca solo en la interfaz. Un usuario con `activo = false`
recibe 403 en toda ruta autenticada.

## 3. Historias de usuario (numeración vigente del informe)

| ID | Historia | Prioridad | Criterios de aceptación clave |
|---|---|---|---|
| HU-001 | Registro e inicio de sesión | P0 | Correo único; verificación por código (modo Cognito); error claro ante credenciales inválidas; rutas protegidas redirigen a login |
| HU-002 | Precarga del catálogo de vehículos | P0 | Catálogo público, solo lectura para usuarios; visible para invitados |
| HU-003 | Alta y gestión de vehículos del usuario | P0 | Guardar un modelo del catálogo o un vehículo personalizado; editar/eliminar solo los propios; no altera el catálogo |
| HU-004 | Publicación de un cargador privado | P1 | Requiere sesión; ubicación, conector, potencia, precio por kWh y disponibilidad; campos obligatorios validados; el dueño puede activar/desactivar |
| HU-005 | Registro y consulta de la red colaborativa | P0 | Públicos y privados se consultan juntos; inactivos no aparecen |
| HU-006 | Selección del vehículo para la búsqueda | P0 | Logueado: sus vehículos + catálogo; invitado: catálogo |
| HU-007 | Ingreso de parámetros de búsqueda | P0 | Ubicación (GPS, texto o mapa) o ruta (origen y destino); batería actual → urgencia |
| HU-008 | Cálculo de la recomendación | P0 | Orden por scoring; excluye incompatibles; mensaje si no hay resultados |
| HU-009 | Visualización de los cargadores recomendados | P0 | Lista y mapa; cada ítem muestra distancia, conector, potencia, disponibilidad, tiempo y costo |
| HU-010 | Reserva del cargador seleccionado | P0 | Requiere sesión; no permite solapar horarios (409); el usuario ve y cancela sus reservas |
| HU-011 | Favoritos y rutas guardadas | P1 | Requiere sesión; guardar/quitar cargadores favoritos y rutas reutilizables |

Dependencias: HU-003→(001,002) · HU-004→001 · HU-005→004 · HU-006→(002,003) · HU-008→(005,006,007) · HU-009→008 · HU-010→009 · HU-011→001.

## 4. Arquitectura

### 4.1 Objetivo en la nube (documentado, no se despliega en la demo)
Cliente React → HTTPS → Application Load Balancer → backend Node.js en Amazon ECS con Fargate (imagen en Amazon ECR) →
Amazon RDS PostgreSQL con PostGIS · autenticación con Amazon Cognito · Routes API de Google Maps Platform (consulta externa).

### 4.2 Modo demo local (por defecto)
```
Navegador ──► web (Vite dev / archivos estáticos) ──► api (Express) ──► PostgreSQL+PostGIS (Docker)
                                                        ├─ AuthProvider  = local (JWT HS256)   [alternativa: cognito]
                                                        └─ RoutingProvider = offline (Haversine) [alternativa: google]
```
Los dos proveedores se eligen por variables de entorno y respetan una **interfaz única**; el resto del código no sabe cuál está activo.

### 4.3 Variables de entorno
| Variable | Ejemplo / valores | Uso |
|---|---|---|
| `PORT` | `3000` | Puerto de la API |
| `DATABASE_URL` | `postgres://tfg:tfg@localhost:5432/tfg` | Conexión a PostgreSQL |
| `AUTH_MODE` | `local` \| `cognito` | Proveedor de autenticación |
| `JWT_SECRET` | cadena larga aleatoria | Solo modo local |
| `COGNITO_REGION`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID` | (del User Pool) | Solo modo Cognito |
| `ROUTING_PROVIDER` | `auto` \| `offline` \| `google` | `auto` = google si hay clave, si no offline |
| `GOOGLE_MAPS_API_KEY` | (clave) | Solo Google |
| `GEOCODING_PROVIDER` | `static` \| `nominatim` | Búsqueda de direcciones |
| `CORS_ORIGIN` | `http://localhost:5173` | Orígenes permitidos (dev) |
| `TZ` | `America/Argentina/Cordoba` | Zona horaria de reservas |
| `CANDIDATES_LIMIT` | `8` | Máximo de cargadores evaluados por búsqueda |
| `SEARCH_RADIUS_KM` | `20` | Radio de preselección (modo ubicación) |
| `CORRIDOR_KM` | `5` | Ancho del corredor (modo ruta) |
| `VITE_API_URL`, `VITE_AUTH_MODE`, `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`, `VITE_COGNITO_REGION` | | Frontend |

## 5. Modelo de datos (PostgreSQL + PostGIS)
Basado en el DER del informe. Marcado con `-- EXT` lo agregado por la implementación (ver sección 15).
Claude Code debe crear estas estructuras con migraciones de Knex y **verificar** que cada sentencia sea válida en PostgreSQL 16.
El DDL base fue probado por el autor del documento en PostgreSQL 16 con PostGIS 3.4: las restricciones de reservas solapadas (rechaza solapes, permite reservas contiguas y reutilizar un horario cancelado),
de cargadores privados sin dueño y de vehículos personalizados incompletos funcionan como se espera, y las consultas de radio y de corredor (`ST_DWithin`) son válidas.

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE tipo_conector   AS ENUM ('TIPO_2','CCS_COMBO','CHADEMO');
CREATE TYPE tipo_cargador   AS ENUM ('publico','privado');
CREATE TYPE estado_cargador AS ENUM ('activo','inactivo');
CREATE TYPE estado_reserva  AS ENUM ('pendiente','confirmada','cancelada');
CREATE TYPE dia_semana      AS ENUM ('lunes','martes','miercoles','jueves','viernes','sabado','domingo');

CREATE TABLE usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cognito_sub text UNIQUE NOT NULL,          -- en modo local: uuid generado
  nombre text NOT NULL,
  email text UNIQUE NOT NULL,
  fecha_registro date NOT NULL DEFAULT current_date,
  activo boolean NOT NULL DEFAULT true       -- EXT
);

CREATE TABLE vehiculo_modelo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marca text NOT NULL, modelo text NOT NULL,
  capacidad_bateria numeric(6,2) NOT NULL CHECK (capacidad_bateria > 0),  -- kWh
  consumo numeric(5,2) NOT NULL CHECK (consumo > 0),                      -- kWh/100 km
  tipo_conector tipo_conector NOT NULL,
  potencia_max_ac numeric(5,1) NOT NULL,                                  -- EXT kW
  potencia_max_dc numeric(5,1),                                           -- EXT kW (NULL = sin carga DC)
  UNIQUE (marca, modelo)
);

CREATE TABLE vehiculo_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  modelo_id uuid REFERENCES vehiculo_modelo(id),   -- NULL = vehículo personalizado
  marca text, modelo text, capacidad_bateria numeric(6,2), consumo numeric(5,2),
  tipo_conector tipo_conector, potencia_max_ac numeric(5,1), potencia_max_dc numeric(5,1),
  CHECK (modelo_id IS NOT NULL OR (marca IS NOT NULL AND modelo IS NOT NULL AND capacidad_bateria IS NOT NULL
         AND consumo IS NOT NULL AND tipo_conector IS NOT NULL AND potencia_max_ac IS NOT NULL))
);
-- Vista vehiculo_usuario_detalle: resuelve con COALESCE los datos del catálogo o los propios.

CREATE TABLE cargador (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES usuario(id) ON DELETE SET NULL,   -- NULL en públicos
  nombre text NOT NULL, direccion text,                          -- EXT
  tipo tipo_cargador NOT NULL,
  ubicacion geography(Point,4326) NOT NULL,
  tipo_conector tipo_conector NOT NULL,
  potencia numeric(5,1) NOT NULL CHECK (potencia > 0),           -- kW
  precio_kwh numeric(8,2) NOT NULL CHECK (precio_kwh >= 0),      -- EXT (ARS por kWh)
  estado estado_cargador NOT NULL DEFAULT 'activo',
  CHECK (tipo = 'publico' OR usuario_id IS NOT NULL)
);
CREATE INDEX cargador_ubicacion_gix ON cargador USING gist (ubicacion);

CREATE TABLE disponibilidad (   -- sin filas = disponible 24/7
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cargador_id uuid NOT NULL REFERENCES cargador(id) ON DELETE CASCADE,
  dia_semana dia_semana NOT NULL, hora_inicio time NOT NULL, hora_fin time NOT NULL,
  CHECK (hora_fin > hora_inicio)
);

CREATE TABLE reserva (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  cargador_id uuid NOT NULL REFERENCES cargador(id) ON DELETE CASCADE,
  fecha date NOT NULL, hora_inicio time NOT NULL, hora_fin time NOT NULL,
  estado estado_reserva NOT NULL DEFAULT 'confirmada',
  CHECK (hora_fin > hora_inicio),
  rango tsrange GENERATED ALWAYS AS (tsrange(fecha + hora_inicio, fecha + hora_fin)) STORED,  -- EXT
  EXCLUDE USING gist (cargador_id WITH =, rango WITH &&) WHERE (estado <> 'cancelada')       -- evita solapes
);

CREATE TABLE ruta_guardada (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  origen_lat double precision NOT NULL, origen_lng double precision NOT NULL,
  destino_lat double precision NOT NULL, destino_lng double precision NOT NULL
);

CREATE TABLE favorito (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  cargador_id uuid NOT NULL REFERENCES cargador(id) ON DELETE CASCADE,
  UNIQUE (usuario_id, cargador_id)
);

-- EXT (infraestructura): caché de resultados de la Routes API (control de costo)
CREATE TABLE cache_ruta (
  clave text PRIMARY KEY, distancia_m integer NOT NULL, duracion_s integer NOT NULL,
  creado timestamptz NOT NULL DEFAULT now()
);
```
**Solo modo local** (carpeta `migrations_dev/`, nunca se aplica en la nube):
```sql
CREATE TABLE dev_credencial (
  usuario_id uuid PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
  password_hash text NOT NULL, rol text NOT NULL DEFAULT 'user' CHECK (rol IN ('user','admin'))
);
```
Las reservas no cruzan medianoche (`hora_fin > hora_inicio`). Zona horaria de negocio: `America/Argentina/Cordoba`.

## 6. Motor de recomendación (núcleo del proyecto)
Ubicación: `api/src/engine/`. Módulo **puro**, con tests. Interfaz `ScoringStrategy` para poder sumar otra técnica (p. ej. TOPSIS) sin
tocar el resto. Implementación por defecto: **suma ponderada con normalización min–max (WSM)**.

### 6.1 Entradas
- `vehiculo`: `capacidadBateriaKwh`, `consumoKwhPor100km`, `tipoConector`, `potenciaMaxAcKw`, `potenciaMaxDcKw | null`.
- `bateriaPct` (0–100), `modo` (`ubicacion` | `ruta`), `origen`, `destino?`, `ahora` (Date, inyectable para tests).
- Candidatos ya preseleccionados con sus tiempos/distancias del `RoutingProvider`, su disponibilidad semanal y reservas activas.

### 6.2 Urgencia (derivada de la batería)
`bateriaPct > 70` → **baja** · `30 ≤ bateriaPct ≤ 70` → **media** · `bateriaPct < 30` → **alta**.
La UI muestra también la **autonomía actual** = `capacidad × (bateriaPct/100) / consumo × 100` km.

### 6.3 Filtros excluyentes (en este orden; registrar el motivo de cada descarte)
1. **Compatibilidad de conector** (regla simplificada): vehículo `CCS_COMBO` → acepta `CCS_COMBO` y `TIPO_2`; `TIPO_2` → `TIPO_2`; `CHADEMO` → `CHADEMO`.
   Un cargador de corriente continua (`CCS_COMBO`/`CHADEMO`) exige `potenciaMaxDcKw` no nulo.
2. **Alcanzable:** `autonomiaActualKm × 0.90 ≥ distanciaKm` (margen de seguridad 10 %) y SoC de llegada ≥ 5 %.
3. **Disponible** en la ventana `[llegada, llegada + tiempoDeCarga]`: ver 6.4.
Si ninguno sobrevive → resultado vacío con código: `SIN_CARGADORES_CERCANOS`, `SIN_COMPATIBLES`, `FUERA_DE_AUTONOMIA` o `SIN_DISPONIBILIDAD`.

### 6.4 Estimaciones por candidato
- `distanciaKm`, `viajeMin` ← RoutingProvider (en modo ruta: `desvioKm = d(origen→c) + d(c→destino) − d(origen→destino)` y el tiempo de desvío análogo).
- `socLlegadaPct = bateriaPct − (distanciaKm × consumo / capacidad)`.
- `objetivoPct = min(100, max(80, socLlegadaPct + 10))`; `energiaKwh = (objetivoPct − socLlegadaPct)/100 × capacidad`.
- `potenciaEfectivaKw = 0.9 × min(potenciaCargador, límiteDelVehículo)`, con límite = `potenciaMaxAcKw` si el cargador es `TIPO_2`, o `potenciaMaxDcKw` si es DC.
- `cargaMin = energiaKwh / potenciaEfectivaKw × 60` · `costoEstimado = energiaKwh × precioKwh`.
- **Disponibilidad:** `llegada = ahora + viajeMin`. Cargador sin filas de `disponibilidad` = 24/7. Si la ventana cae fuera de las franjas del día, y la próxima franja
  empieza dentro de 120 min → `esperaMin` hasta esa franja; si no, se descarta. Si solapa con una reserva activa, `esperaMin` = hasta que termine (iterar); si supera 120 min, se descarta.
- `totalMin = viajeMin + esperaMin + cargaMin`.
Todas son simplificaciones documentadas (carga lineal sin curva, sin tráfico, ocupación solo por reservas). Aclararlo en el README.

### 6.5 Scoring
Criterios (todos "menor es mejor"): distancia (o desvío en modo ruta), espera, tiempo de carga, costo. Normalización por criterio entre los candidatos:
`norm = (x − min)/(max − min)` (si `max = min` → 0). `score = 100 × (1 − Σ wᵢ · normᵢ)`.

| Urgencia | w distancia | w espera | w carga | w costo |
|---|---|---|---|---|
| alta (<30 %) | 0.45 | 0.25 | 0.20 | 0.10 |
| media (30–70 %) | 0.30 | 0.20 | 0.25 | 0.25 |
| baja (>70 %) | 0.15 | 0.15 | 0.20 | 0.50 |

Pesos configurables en un único archivo (`engine/config.ts`). Desempate: menor distancia, luego nombre.
Salida por ítem: datos del cargador, métricas (`distanciaKm`, `desvioKm?`, `viajeMin`, `esperaMin`, `cargaMin`, `totalMin`, `energiaKwh`, `costoEstimado`,
`potenciaEfectivaKw`, `socLlegadaPct`), `score`, `desglose` (aporte de cada criterio), `mejorOpcion` (solo el primero) y `advertencias`.
Respuesta global: `urgencia`, `autonomiaActualKm`, `pesos`, `proveedorRutas`, `descartados` (con motivo) y `meta` (cantidad de elementos consultados al proveedor).

### 6.6 Preselección (SQL espacial, antes del motor)
- Modo ubicación: `ST_DWithin(ubicacion, punto, SEARCH_RADIUS_KM*1000)` ordenado por `ST_Distance`, `LIMIT CANDIDATES_LIMIT`, solo `estado = 'activo'`.
- Modo ruta: `ST_DWithin(ubicacion, ST_MakeLine(origen, destino)::geography, CORRIDOR_KM*1000)`, mismo orden y límite.
- Si hay menos de 3 candidatos, ampliar el radio una vez (×2). Esto limita los elementos consultados a la Routes API (control de costo).

## 7. Proveedor de rutas (`api/src/routing`)
Interfaz: `matrix(origenes: LatLng[], destinos: LatLng[]): Promise<Celda[][]>` con `{ distanciaM, duracionS, fuente }`.
- **OfflineProvider:** distancia = Haversine × 1.35 (factor de circuito) · velocidad 30 km/h si ≤ 5 km, 40 km/h si ≤ 25 km, 60 km/h si más. `fuente = 'offline-estimado'`.
- **GoogleRoutesProvider:** `computeRouteMatrix` (Routes API v2). Verificar en la documentación oficial vigente el endpoint, encabezados y *field mask*.
  Usar el **mínimo de campos** (distancia, duración, índices, estado) y **`routingPreference = TRAFFIC_UNAWARE`** para quedar en el nivel de precio más bajo (el análisis de costos del informe supone ese nivel).
  Caché en la tabla `cache_ruta` (clave: coordenadas redondeadas a 4 decimales, TTL 7 días). Contar y loguear los elementos consultados. Si la API falla, caer a Offline y avisar en `advertencias`.
- Selección por `ROUTING_PROVIDER` (`auto`: Google si hay clave). 
- **Geocodificación** (`GET /api/v1/geocodificar?q=`): `static` = lista fija de ~15 barrios/ciudades de Córdoba con coordenadas; `nominatim` = proxy con `User-Agent` propio,
  máximo 1 pedido por segundo, `countrycodes=ar`, caché en memoria. Nominatim solo para uso liviano de demo.

## 8. API REST (`/api/v1`, JSON)
| Método y ruta | Acceso | Descripción |
|---|---|---|
| `GET /salud` | público | Healthcheck (usado por el balanceador) |
| `POST /auth/local/registro`, `POST /auth/local/login` | público (solo `AUTH_MODE=local`) | Credenciales de desarrollo; devuelve JWT |
| `GET /yo` | user/admin | Perfil; hace *upsert* del usuario por `sub` + email del token |
| `GET /vehiculos-modelo?q=` | público | Catálogo |
| `GET/POST /mis-vehiculos`, `PUT/DELETE /mis-vehiculos/:id` | user/admin | Vehículos propios (del catálogo o personalizados) |
| `GET /cargadores?bbox=` | público | Cargadores activos (para el mapa) |
| `POST /cargadores`, `GET /mis-cargadores`, `PUT /cargadores/:id`, `PUT /cargadores/:id/disponibilidad`, `DELETE /cargadores/:id` | user (propios) / admin (todos) | Publicación y gestión |
| `POST /recomendaciones` | público | Cuerpo: `{ vehiculo: {modeloId}|{vehiculoUsuarioId}|{personalizado}, bateriaPct, modo, origen, destino? }` |
| `POST /reservas`, `GET /mis-reservas`, `PATCH /reservas/:id/cancelar` | user/admin | `409 RESERVA_SOLAPADA` si hay conflicto |
| `GET/POST/DELETE /favoritos` · `GET/POST/DELETE /rutas-guardadas` | user/admin | HU-011 |
| `GET /geocodificar?q=` | público | Ver sección 7 |
| `GET /admin/usuarios`, `PATCH /admin/usuarios/:id` | admin | Habilitar/deshabilitar (`activo`) y, en modo local, cambiar rol |
| `PATCH /admin/cargadores/:id`, `POST/PUT/DELETE /admin/vehiculos-modelo` | admin | Moderación y catálogo |
Todas las entradas se validan con `zod`; paginación simple (`limit`/`offset`) en listados. Rate limit en `/recomendaciones` y `/geocodificar`.

## 9. Autenticación
Misma forma de token en ambos modos: claims `sub`, `email`, `cognito:groups` (arreglo).
- **`AUTH_MODE=cognito`:** el backend verifica el **ID token** de Cognito con `aws-jwt-verify` (necesita el email, que viaja en el ID token). El frontend usa Amplify Auth
  (registro, confirmación por código, login, logout). App client **público** (sin secreto). Rol = `admin` si `cognito:groups` lo incluye; si no, `user`.
  El backend **no guarda contraseñas**. Acciones administrativas sobre Cognito (alta de grupos, deshabilitar en el pool) son P2 y opcionales: usar `@aws-sdk/client-cognito-identity-provider` detrás de una interfaz, con error claro si no hay credenciales.
- **`AUTH_MODE=local` (solo desarrollo/demo):** `registro`/`login` con `bcryptjs`, JWT HS256 con las mismas claims. Mostrar un aviso visible "Modo demo local — no usar en producción".
  Usuarios de demo sembrados: `admin@demo.local` / `Admin123!` (rol admin) y `usuario@demo.local` / `Usuario123!` (rol user).
- Política de contraseña del informe (validar en el cliente y en local): mínimo 8, con mayúscula, minúscula, número y símbolo.
- Middleware único: `autenticar` (opcional u obligatorio) → `requerirRol('admin')` → `esDuenoOAdmin`. Verifica `usuario.activo`.

## 10. Frontend
Mobile-first; desde 1024 px usa diseño de escritorio. La referencia visual son los mockups en `docs/mockups/` (exportados por el autor). Si faltan, usar estas reglas.

### 10.1 Tokens de diseño
Primario `#0F9D6B` · primario claro (fondo seleccionado) `#F1FBF6` · fondo `#F4F6F3` · superficie `#FFFFFF` · texto `#1B1D1A` · texto secundario `#55584F` ·
texto atenuado `#9A9D93` · borde `#DDE2DC` / `#E7EAE4` · pendiente `#B36B00` sobre `#FFF7E6` · error/favorito `#D4534E`.
Tipografías: **Sora** (títulos, botones, números) y **Plus Jakarta Sans** (cuerpo). Radios: 12 px campos, 14 px botones, 16–24 px tarjetas.
Botón principal: fondo primario, texto blanco, ancho completo en móvil. Íconos de trazo (outline, 2 px).

### 10.2 Pantallas y rutas
| Ruta | Pantalla | HU | Notas |
|---|---|---|---|
| `/inicio` | Bienvenida | 001 | "Iniciar sesión" / "Continuar como invitado" |
| `/login` | Login / Registro / Confirmar código | 001 | Pestañas; en modo local sin confirmación |
| `/` | **Home = buscador** | 006, 007 | Vehículo (select) + chips (batería kWh, autonomía km, conector) · toggle Ubicación/Ruta · slider de batería → indicadores de urgencia + autonomía actual |
| `/resultados` | Cargadores recomendados | 008, 009 | Tarjetas con "Mejor opción", métricas y score · botón lista/mapa |
| `/resultados/mapa` | Resultados en mapa | 009 | Leaflet/OSM: ruta punteada (línea recta en offline), pines (el mejor en verde), hoja inferior con la lista |
| `/cargadores/:id` | Detalle y reserva | 010 | Datos del cargador, métricas, "¿Por qué lo recomendamos?" (desglose del score), reserva con fecha/hora precargadas en la hora estimada de llegada |
| `/vehiculos`, `/vehiculos/:id`, `/vehiculos/nuevo` | Mis vehículos / detalle / agregar | 003 | Agregar: "Elegir del catálogo" o "Cargar el mío" |
| `/publicar`, `/mis-cargadores` | Publicar / gestionar cargadores | 004 | Ubicación con clic en el mapa, conector, potencia, precio por kWh, editor de franjas |
| `/reservas` | Mis reservas | 010 | Estados: confirmada (verde), pendiente (ámbar), cancelada (atenuada); cancelar |
| `/favoritos` | Favoritos y rutas guardadas | 011 | Pestañas "Cargadores" y "Rutas guardadas" |
| `/admin` | Administración | P2 | Usuarios, cargadores, catálogo |
Navegación inferior (móvil): Home · Vehículos · Publicar · Reservas · Favoritos. En escritorio: barra superior con los mismos accesos y el buscador como tarjeta central.
Rutas protegidas: redirigen a `/login` y vuelven al destino.

### 10.3 Comportamientos clave
- El slider de batería recalcula en vivo urgencia (resalta Baja / Media / Alta con su rango) y autonomía actual.
- Ubicación: botón de pin (geolocalización del navegador), campo de texto (geocodificación) y clic en el mapa. Ruta: origen y destino.
- El estado de la búsqueda se conserva al ir a Detalle y volver (TanStack Query / estado en URL).
- Estados de carga, vacío (con el motivo devuelto por la API) y error en todas las pantallas. Aviso discreto: "Datos de demostración (sintéticos)".

## 11. Datos de demostración (seed determinístico, semilla fija)
- **Catálogo (≥ 8 modelos).** Incluir Peugeot e-208, BYD Dolphin Mini y Renault Kwid E-Tech, más modelos con conector `CHADEMO` y `TIPO_2`
  (puede ser un modelo ficticio rotulado) para ejercitar el filtro de compatibilidad. Valores **aproximados**, con comentario `// aproximado: verificar con ficha oficial`.
- **Cargadores (≈ 60):** ~20 públicos y ~40 privados, potencias 7.4–150 kW, precios por kWh de ejemplo (ficticios), concentrados en Córdoba capital
  (Centro, Nueva Córdoba, Cerro de las Rosas, Villa Belgrano, etc.) y algunos sobre los corredores Córdoba–Villa Carlos Paz y Córdoba–Alta Gracia para probar el modo ruta.
  Coordenadas ancla aproximadas (verificar): Córdoba centro (−31.4201, −64.1888), Villa Carlos Paz (−31.4241, −64.4978), Alta Gracia (−31.6540, −64.4284).
  Franjas de disponibilidad variadas en los privados (p. ej. 8–20 h, solo fines de semana, 18–23 h) y algunas reservas existentes para mostrar esperas y conflictos.
- **Usuarios** (modo local): los dos de la sección 9, con un vehículo guardado cada uno.
- Todo marcado como sintético. Comando: `npm run db:seed` (idempotente; `--reset` limpia y vuelve a sembrar).

## 12. Validación del motor (`npm run validate`)
Script `api/scripts/validate.ts`, reproducible (`--scenarios 200 --seed 42`).
1. Generar escenarios aleatorios: vehículo del catálogo, batería (0–100), punto de origen en Córdoba, hora del día y modo ubicación (y algunos en modo ruta).
2. **Línea base ("selección manual simulada")**: el cargador compatible y disponible más cercano por distancia, como lo haría una persona mirando un mapa.
3. **Sistema**: el cargador que recomienda el motor con el mismo proveedor de rutas.
4. Métricas por escenario y promedio (más mediana): distancia al cargador (km) · tiempo total (viaje + espera + carga) · costo estimado ·
   **grado de optimalidad** = score del recomendado vs. el mejor candidato posible evaluando **todos** los cargadores (por fuerza bruta, sin la preselección) · % de escenarios donde el sistema elige un cargador distinto de la línea base.
5. Salidas: `docs/validacion/resultados.csv` y `docs/validacion/resultados.md` (tabla sistema vs. línea base, mejora porcentual, cantidad de escenarios sin solución, limitaciones).
**Regla:** reportar lo que salga, incluso si el sistema no mejora una métrica. No redondear a favor ni descartar escenarios incómodos sin explicarlo.

## 13. Tests mínimos
- **Motor (unitarios):** compatibilidad de conectores · alcance con margen de 10 % · derivación de urgencia en los bordes (29, 30, 70, 71) · potencia efectiva con límite del vehículo · energía y costo ·
  normalización (incluyendo `max = min`) · pesos por urgencia · desempate · disponibilidad (franjas, espera por reserva, descarte) · modo ruta (desvío) · resultado vacío con cada código.
- **API (integración con base real):** matriz de permisos de la sección 2 · solape de reservas → 409 · usuario no puede editar cargadores ajenos · catálogo no editable por `user` ·
  `activo=false` → 403 · validación de entradas · `POST /recomendaciones` de punta a punta con el seed.
- **Proveedores:** Google con `fetch` simulado (éxito, error, caché) y Offline con valores conocidos.
- **Frontend:** componente de urgencia/autonomía y flujo de búsqueda con la API simulada. E2E con Playwright (P2).

## 14. No funcionales
- `helmet`, CORS restringido, límite de tamaño de cuerpo, rate limiting, `zod` en toda entrada, SQL parametrizado, logs sin datos personales, `GET /salud`.
- Rendimiento: `POST /recomendaciones` ≤ 1 s con el seed y proveedor offline (≤ 8 candidatos).
- Un solo artefacto de producción: la imagen de `api/` sirve también el build de `web/` (ver `docs/AWS_DEPLOY.md`).
- Licencias de terceros y atribución de OpenStreetMap visible en el mapa.

## 15. Diferencias respecto del diseño documentado en el informe (para actualizar la documentación)
La implementación agrega, y el informe (DER, diagrama de clases, diccionario de datos) debe reflejarlo:
1. `cargador.precio_kwh` (necesario para estimar el costo) y `cargador.nombre`, `cargador.direccion`.
2. `vehiculo_modelo` y `vehiculo_usuario`: `potencia_max_ac` y `potencia_max_dc` (necesarias para el tiempo de carga).
3. `usuario.activo` (deshabilitar cuentas desde el panel de administración).
4. `reserva.rango` (columna generada) y la restricción `EXCLUDE` que impide solapes.
5. Tabla `cache_ruta` (infraestructura) y `dev_credencial` (solo modo local, no forma parte del sistema desplegado).
6. Preselección espacial y proveedor de rutas con caché (mitigación del riesgo R4 del informe).
Registrar en `docs/DECISIONES.md` cualquier otra diferencia que aparezca durante la construcción.
