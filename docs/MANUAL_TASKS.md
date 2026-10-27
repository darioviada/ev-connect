# MANUAL_TASKS — Tareas que hace el autor a mano

> Claude Code **no** debe intentar automatizar estas tareas. Las pantallas de las consolas de AWS y Google cambian con frecuencia:
> los nombres exactos de las opciones pueden variar; lo importante es el resultado esperado de cada paso.
> **La demo local funciona sin hacer nada de las secciones B, C y D.** Esas son para probar los servicios reales.

## Orden recomendado
1. Sección A (preparación) → 2. Claude Code construye las fases 0 a 7 → 3. Sección E (mockups) en paralelo → 4. Secciones B, C, D solo si querés probar servicios reales → 5. Secciones F, G, H para cerrar el informe.

## A. Preparar el entorno
- [ ] Instalar **Node.js LTS (≥ 22)**, **Git**, **Docker Desktop** y **Claude Code**.
- [ ] Crear el repositorio (privado) y clonarlo. Copiar adentro `CLAUDE.md` y la carpeta `docs/`.
- [ ] Crear la carpeta `docs/mockups/` y exportar allí las pantallas del canvas de diseño (imágenes PNG, una por pantalla, nombre = ruta, p. ej. `home.png`). Claude Code puede leer imágenes del repositorio.
- [ ] Abrir Claude Code en la raíz del repositorio y pegar el prompt sugerido al final de `docs/PLAN.md`.
- [ ] Decidir cómo trabajar con los cambios: revisar cada fase, correr los tests y hacer el commit vos.

## B. (Opcional) Cuenta de AWS y Amazon Cognito
Sirve para probar el modo `AUTH_MODE=cognito`. Cognito está en el nivel gratuito para los volúmenes de una demo (verificar la política vigente en la página de precios).
1. **Crear la cuenta de AWS** (requiere tarjeta). Activar **MFA en el usuario raíz** y no usarlo para el trabajo diario.
2. **Crear un usuario administrador** para el trabajo diario (IAM Identity Center o un usuario IAM con permisos de administrador) con MFA.
3. **Presupuesto con alertas:** en AWS Budgets crear un presupuesto mensual bajo (por ejemplo US$ 10) con alerta por correo al 50 % y 100 %. Hacerlo **antes** de crear cualquier recurso.
4. **Elegir la Región** de trabajo (el análisis de costos del informe usa `us-east-1`) y usar siempre la misma.
5. **Crear el User Pool de Cognito** (consola de Amazon Cognito → *Create user pool*):
   - Tipo de aplicación: **aplicación de página única (SPA)** / cliente **público, sin secreto**.
   - Identificador de inicio de sesión: **correo electrónico**. Habilitar el **autorregistro**.
   - Política de contraseñas: mínimo **8** caracteres, con **mayúscula, minúscula, número y símbolo**.
   - MFA: sin MFA para la demo (opcional para administradores más adelante).
   - Verificación: correo electrónico con código. El remitente por defecto de Cognito tiene un límite diario bajo de correos (verificar el valor vigente); alcanza para una demo.
   - Flujos de autenticación del cliente: habilitar el de usuario y contraseña seguro (**SRP**) y el de **refresh token**.
6. **Crear los grupos** `user` y `admin` en el User Pool.
7. **Crear el primer administrador:** registrar tu usuario (por la app o desde la consola) y **agregarlo al grupo `admin`**. Los demás usuarios no necesitan grupo (se tratan como `user`).
8. **Anotar** el *User Pool ID*, el *App client ID* y la Región. Completar `.env`:
   `AUTH_MODE=cognito`, `COGNITO_REGION`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID` y las equivalentes `VITE_*` para el frontend.
9. **Probar:** registrarse, confirmar el código del correo, iniciar sesión y verificar en la API (`GET /api/v1/yo`) que el rol sea el esperado. No pegues tokens en sitios de terceros.
10. Al terminar la demo, si no la vas a usar, **eliminar el User Pool**.

## C. (Opcional) Google Maps Platform — Routes API
Sirve para usar distancias y tiempos reales (`ROUTING_PROVIDER=google` o `auto`). **Puede generar costo** si se supera el uso gratuito mensual.
1. Crear un proyecto en Google Cloud y asociarle una **cuenta de facturación** (requiere tarjeta).
2. **Presupuesto y alertas** en Cloud Billing, con un umbral bajo. Si querés un tope duro, limitar la **cuota diaria** de la API desde la sección de Cuotas.
3. **Habilitar la Routes API** en el proyecto.
4. **Crear una clave de API** y **restringirla** a la Routes API (restricción de API). La clave se usa **solo desde el backend**; nunca va en el frontend ni en el repositorio.
5. Completar `.env`: `GOOGLE_MAPS_API_KEY=...` y `ROUTING_PROVIDER=auto`.
6. Probar una recomendación y revisar en los logs de la API el contador de elementos consultados y el uso en la consola de Google. El costo vigente por uso y los topes gratuitos están en la lista de precios oficial de Google Maps Platform.

## D. (Opcional) Base de datos en RDS (si la base no puede correr local)
Ver `docs/AWS_DEPLOY.md`, sección 4. Resumen: instancia PostgreSQL 16 (db.t4g.micro), acceso restringido a tu IP **de forma temporal**, correr migraciones y seed
con tu `DATABASE_URL`, y **borrar o detener** la instancia al terminar (genera costo mientras existe).

## E. Material para el informe y la defensa
- [ ] Capturas de cada pantalla en funcionamiento (Claude Code las guarda en `docs/capturas/`) para reemplazar los bocetos en el informe.
- [ ] Verificar contra las **fichas oficiales** las especificaciones de los vehículos del seed (batería, consumo, conector, potencias AC/DC) y **citar las fuentes** en el informe.
- [ ] Revisar que los precios por kWh y las ubicaciones del seed estén rotulados como **datos de ejemplo**.
- [ ] Grabar un video corto de la demo (opcional, útil como respaldo si falla el entorno del profesor).

## F. Actualizar el informe para que coincida con lo construido
- [ ] **DER, diagrama de clases y diccionario de datos:** incorporar lo listado en `docs/SPEC.md` sección 15 (precio por kWh, potencias del vehículo, `activo`, etc.). Recordá que el diagrama de clases no lleva atributos `id`.
- [ ] **Alcances y Seguridad:** si alguna funcionalidad P1/P2 no llegó a implementarse (favoritos, administración, etc.), ajustar el informe: la tabla de permisos, las historias de usuario y los alcances deben reflejar solo lo que existe.
- [ ] **TICs vs. costos:** el informe dice que la Routes API considera el tráfico en tiempo real, pero el análisis de costos y la demo usan el nivel sin tráfico (`TRAFFIC_UNAWARE`).
  Hay que alinear: o se ajusta el texto de TICs, o se actualiza el análisis de costos al nivel con tráfico.
- [ ] **Arquitectura:** la demo sirve el frontend desde el mismo contenedor del backend (no hay S3 ni CloudFront). Verificar que el diagrama y el texto lo reflejen.
- [ ] **Validación:** copiar al informe **solo** lo que salga de `npm run validate`, con su semilla y cantidad de escenarios, y actualizar Resumen, Abstract y Conclusiones con valores reales.
  Si el sistema no mejora alguna métrica, decirlo y explicarlo.

## G. Control de costos y limpieza
- [ ] Mantener las alertas de presupuesto en AWS y Google.
- [ ] Al finalizar las pruebas en la nube: poner el servicio ECS en 0 tareas, eliminar el Application Load Balancer, detener/eliminar RDS, eliminar repositorios ECR y snapshots que no uses, y revisar la facturación al día siguiente.
- [ ] Rotar o eliminar la clave de Google y los usuarios de prueba.

## H. Lista final antes de entregar
- [ ] El repositorio se clona y levanta en una máquina limpia siguiendo solo `docs/RUN_LOCAL.md`.
- [ ] No hay secretos en el historial de Git (`.env` ignorado).
- [ ] `npm test` y `npm run lint` pasan.
- [ ] El informe describe lo que realmente existe, en pasado para la construcción y en presente para el funcionamiento.
