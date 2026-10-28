# Licencias de terceros

Dependencias directas de producción. Las versiones y licencias se leyeron de cada paquete instalado (`package.json`) el 28/10/2026. Las dependencias de desarrollo (TypeScript, Vite, Vitest, ESLint, Playwright, etc.) no se distribuyen en la imagen de producción.

| Paquete | Versión | Licencia | Dónde |
|---|---|---|---|
| aws-jwt-verify | 5.2.1 | Apache-2.0 | api |
| bcryptjs | 3.0.3 | BSD-3-Clause | api |
| cors | 2.8.6 | MIT | api |
| express | 5.3.0 | MIT | api |
| express-rate-limit | 8.7.1 | MIT | api |
| helmet | 8.3.0 | MIT | api |
| jsonwebtoken | 9.0.3 | MIT | api |
| knex | 3.3.0 | MIT | api |
| pg | 8.23.1 | MIT | api |
| pino | 10.4.0 | MIT | api |
| pino-http | 11.0.0 | MIT | api |
| zod | 4.6.7 | MIT | api |
| @fontsource/plus-jakarta-sans | 5.3.0 | OFL-1.1 | web |
| @fontsource/sora | 5.3.0 | OFL-1.1 | web |
| @tanstack/react-query | 5.105.0 | MIT | web |
| aws-amplify | 6.22.2 | Apache-2.0 | web |
| leaflet | 1.9.4 | BSD-2-Clause | web |
| react | 19.3.1 | MIT | web |
| react-dom | 19.3.1 | MIT | web |
| react-leaflet | 5.0.0 | **Hippocratic-2.1** | web |
| react-router | 8.5.1 | MIT | web |

**react-leaflet (Hippocratic License 2.1):** es una licencia "ética" que agrega condiciones de respeto a los derechos humanos. No está aprobada por la Open Source Initiative. El uso académico de esta demo no la contradice, pero conviene mencionarlo en el informe. Si hiciera falta evitarla, Leaflet (BSD-2-Clause) se puede usar directamente sin el envoltorio de React.

## Datos y servicios

- **Mapas:** mosaicos y datos de © colaboradores de [OpenStreetMap](https://www.openstreetmap.org/copyright), bajo licencia ODbL. La atribución se muestra en cada mapa.
- **Base de datos:** imagen `postgis/postgis:16-3.4` (PostgreSQL License, PostGIS GPL-2.0), que se usa como servicio aparte.
- **Geocodificación opcional:** [Nominatim](https://operations.osmfoundation.org/policies/nominatim/) (OSMF). Uso liviano, con 1 pedido por segundo como máximo y sin autocompletado (D-023).
- **Rutas opcionales:** Google Maps Platform, Routes API, según los términos de servicio de Google (requiere cuenta y clave propias).
- **Íconos y logo:** dibujados para el proyecto (trazos SVG propios).
- **Datos de demostración:** sintéticos, generados por el seed del proyecto.
