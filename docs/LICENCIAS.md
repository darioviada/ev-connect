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

## Fotos de los vehículos del catálogo (D-047)

Fotos de Wikimedia Commons con licencia **CC BY-SA 4.0** (https://creativecommons.org/licenses/by-sa/4.0/), verificadas el 2026-11-06 en la página de cada archivo. **Cambio realizado:** se usan redimensionadas a 800 px de ancho (la miniatura oficial de Commons). La interfaz muestra el crédito junto a cada foto, con enlace a la fuente. Los archivos están en `api/seeds/datos/fotos/`.

| Modelo | Foto (archivo en Commons) | Autor |
|---|---|---|
| Peugeot e-208 | [Peugeot e-208 Allure Genf 2019 1Y7A5132.jpg](https://commons.wikimedia.org/wiki/File:Peugeot_e-208_Allure_Genf_2019_1Y7A5132.jpg) | Alexander Migl |
| BYD Dolphin Mini | [BYD Dolphin Surf IMG 3808.jpg](https://commons.wikimedia.org/wiki/File:BYD_Dolphin_Surf_IMG_3808.jpg): Dolphin Surf, nombre europeo | Alexander-93 |
| Renault Kwid E-Tech | [Dacia Spring 1X7A0346.jpg](https://commons.wikimedia.org/wiki/File:Dacia_Spring_1X7A0346.jpg): Dacia Spring, gemelo europeo | Alexander Migl |
| Nissan Leaf | [2018 Nissan Leaf Tekna Front.jpg](https://commons.wikimedia.org/wiki/File:2018_Nissan_Leaf_Tekna_Front.jpg) | Vauxford |
| Volvo EX30 | [Volvo EX30 1X7A1950.jpg](https://commons.wikimedia.org/wiki/File:Volvo_EX30_1X7A1950.jpg) | Alexander-93 |
| BYD Yuan Plus | [BYD Atto 3 1X7A6494.jpg](https://commons.wikimedia.org/wiki/File:BYD_Atto_3_1X7A6494.jpg): Atto 3, nombre europeo | Alexander Migl |
| BYD Seal | [BYD Seal IAA 2023 1X7A0371.jpg](https://commons.wikimedia.org/wiki/File:BYD_Seal_IAA_2023_1X7A0371.jpg) | Alexander-93 |

Las fotos que suba un administrador quedan bajo su responsabilidad: la pantalla pide el crédito y recuerda usar solo imágenes propias o con licencia que permita publicarlas.
