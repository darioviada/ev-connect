# AWS_DEPLOY — Despliegue en AWS (para más adelante)

> **Claude Code: no ejecutes nada de este documento.** Es una guía para el autor. Tu tarea es mantener el código compatible con estos pasos
> (Dockerfile, variables de entorno, `GET /api/v1/salud`, migraciones ejecutables como comando).
> Los nombres de las pantallas y algunos valores pueden haber cambiado en la consola; usá la documentación oficial vigente de cada servicio.

Arquitectura objetivo (informe): cliente → **Application Load Balancer** → **Amazon ECS con Fargate** (imagen en **Amazon ECR**) → **Amazon RDS PostgreSQL + PostGIS**,
con **Amazon Cognito** para identidades y la **Routes API** de Google como servicio externo.
**Costo orientativo** (escenario piloto del informe): ≈ US$ 67 por mes con los recursos encendidos. Poner alertas de presupuesto antes de empezar (ver `MANUAL_TASKS.md`, sección B).

## 1. Preparar la imagen
- `api/Dockerfile` multi-stage: etapa 1 compila `web/` (las variables `VITE_*` se pasan como *build args* porque quedan fijas en el build), etapa 2 compila la API y copia el build del frontend para que la API lo sirva.
- La imagen escucha en el puerto `3000`, usa un usuario no root y expone `GET /api/v1/salud`.
- Probar localmente: `docker build -t tfg-demo ./ -f api/Dockerfile` y `docker compose up --build`.

## 2. Amazon ECR
1. Crear un repositorio privado (por ejemplo `tfg-demo`).
2. Autenticar Docker contra ECR con la AWS CLI (`aws ecr get-login-password ...`), etiquetar la imagen con la URI del repositorio y hacer `docker push`.
3. Etiquetar con versiones (`v1`, `v2`) y no solo `latest`. Opcional: política de ciclo de vida para borrar imágenes viejas (el informe supone 2 GB almacenados).

## 3. Red y seguridad
- Para la demo alcanza la **VPC por defecto**, con subredes públicas en **dos zonas de disponibilidad** (el balanceador lo exige).
- Tres *security groups*: `sg-alb` (entrada 80/443 desde Internet) → `sg-ecs` (entrada 3000 solo desde `sg-alb`) → `sg-rds` (entrada 5432 solo desde `sg-ecs`).
- Las tareas de ECS van en subredes públicas con IP pública para llegar a ECR, CloudWatch y a la Routes API **sin NAT Gateway** (coherente con el análisis de costos). Las direcciones IPv4 públicas se facturan por hora.

## 4. Amazon RDS (PostgreSQL con PostGIS)
1. Crear una instancia **PostgreSQL 16**, clase `db.t4g.micro`, **Single-AZ**, 20 GB gp3, **sin acceso público**, en `sg-rds`.
2. Respaldos automáticos con retención de **7 días** (política de Seguridad del informe). Elegir ventana de respaldo en horario de baja demanda.
3. Guardar la contraseña maestra en un lugar seguro (AWS Secrets Manager tiene costo por secreto; Systems Manager Parameter Store *SecureString* es una alternativa; verificar precios vigentes).
4. Las migraciones crean las extensiones `postgis` y `btree_gist`. **La primera vez hay que correrlas con el usuario maestro** (el que tiene permisos para crear extensiones).
5. Ejecutar migraciones como **tarea única de ECS** con la misma imagen y el comando `npm run db:migrate` (sobrescribir el *command* de la definición de tarea). El *seed* de datos sintéticos es opcional en la nube y no debe crear los usuarios de modo local cuando `AUTH_MODE=cognito`.
6. Para depurar desde tu equipo: habilitar acceso público **temporalmente**, limitado a tu IP, y revertirlo al terminar.

## 5. Amazon Cognito
Seguir `MANUAL_TASKS.md`, sección B. Para producción: un User Pool propio, grupos `user` y `admin`, y las variables `COGNITO_*` / `VITE_COGNITO_*` del entorno.
Mejora opcional: una función Lambda *post-confirmation* que agregue automáticamente a cada usuario nuevo al grupo `user` (la demo ya trata a quien no tiene grupo como `user`).
Mejora opcional: MFA para los administradores.

## 6. Amazon ECS con Fargate
1. **Clúster** de ECS (Fargate).
2. **Definición de tarea:** Fargate, **0,5 vCPU y 1 GB**, contenedor con la imagen de ECR, puerto 3000. Variables: `AUTH_MODE=cognito`, `COGNITO_*`, `ROUTING_PROVIDER=google`, `GEOCODING_PROVIDER=static` (o `nominatim` con uso liviano), `TZ=America/Argentina/Cordoba`, `NODE_ENV=production`.
   Los secretos (`DATABASE_URL`, `GOOGLE_MAPS_API_KEY`) se inyectan desde Secrets Manager o Parameter Store, **no** como texto plano.
3. **Rol de ejecución** (descargar la imagen de ECR, escribir logs en CloudWatch, leer los secretos) y **rol de tarea** (vacío; solo agregar permisos de Cognito de administración si se implementa esa función P2).
4. **Logs** con el controlador `awslogs`, con retención corta para no acumular costo.
5. **Servicio:** 1 tarea deseada, subredes públicas con IP pública, `sg-ecs`, asociado al *target group* del balanceador.

## 7. Application Load Balancer
1. Balanceador **internet-facing** en dos subredes de zonas distintas, con `sg-alb`.
2. *Target group* tipo IP, protocolo HTTP, puerto 3000, **health check** en `/api/v1/salud`.
3. Listener **443** con certificado de **AWS Certificate Manager** (requiere un dominio propio) y listener **80** que redirige a 443.
4. Apuntar el dominio al balanceador (Route 53 u otro DNS). **Sin dominio/HTTPS no se debe usar con usuarios reales:** los tokens de sesión viajarían sin cifrar.

## 8. Verificación posterior al despliegue
- `GET https://<dominio>/api/v1/salud` responde 200. Registrarse y confirmar el correo, iniciar sesión, buscar, reservar.
- Logs de la tarea sin errores; contador de elementos consultados a la Routes API dentro de lo esperado; el target group figura como *healthy*.

## 9. Respaldos según la política del informe
- Automáticos en RDS (7 días, ver 4.2).
- **Snapshot manual** antes de cada despliegue que cambie el esquema y uno mensual; copiar el mensual a una **segunda Región**.
- **Exportación mensual** con `pg_dump` hacia los discos externos (rotación en dos ubicaciones). **Probar la restauración cada tres meses** en una instancia temporal.

## 10. Apagado y limpieza (para evitar costos)
Orden sugerido: poner el servicio ECS en 0 → eliminar el servicio y el clúster → eliminar el balanceador y el *target group* → detener o eliminar RDS (una instancia detenida se reinicia sola después de unos días; verificar) →
eliminar snapshots que no uses → eliminar el repositorio ECR → eliminar el User Pool si no se usa → revisar la facturación al día siguiente.
