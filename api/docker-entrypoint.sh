#!/bin/sh
# Punto de entrada del contenedor.
# Modo demo local (AUTH_MODE=local): si JWT_SECRET falta o es el valor de demostración de .env.example,
# se genera uno aleatorio para este contenedor. Así `docker compose up` funciona sin editar nada y nunca se
# usa en producción un secreto conocido (docs/DECISIONES.md D-003). Al reiniciar el contenedor, las sesiones
# se invalidan y hay que volver a iniciar sesión.
set -e

SECRETO_DEMO="demo-local-inseguro-cambiar-antes-de-usar-fuera-de-la-demo"

if [ "${AUTH_MODE:-local}" = "local" ]; then
  if [ -z "${JWT_SECRET:-}" ] || [ "$JWT_SECRET" = "$SECRETO_DEMO" ]; then
    JWT_SECRET="$(node -e "process.stdout.write(require('node:crypto').randomBytes(48).toString('base64url'))")"
    export JWT_SECRET
    echo "AUTH_MODE=local: se generó un JWT_SECRET aleatorio para este contenedor."
  fi
fi

exec "$@"
