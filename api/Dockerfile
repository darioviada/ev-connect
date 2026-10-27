# syntax=docker/dockerfile:1
# Imagen única de producción: compila la web y la API, y la API sirve la web (docs/AWS_DEPLOY.md §1).
# Construir desde la raíz del repositorio:  docker build -t tfg-demo -f api/Dockerfile .

# --- Etapa 1: dependencias completas y build -----------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json api/
COPY web/package.json web/
RUN npm ci

COPY tsconfig.base.json ./
COPY api api
COPY web web

# Las VITE_* quedan fijas en el build de la web: se pasan como build args.
ARG VITE_API_URL=/api/v1
ARG VITE_AUTH_MODE=local
ARG VITE_COGNITO_REGION=
ARG VITE_COGNITO_USER_POOL_ID=
ARG VITE_COGNITO_CLIENT_ID=
ENV VITE_API_URL=$VITE_API_URL \
    VITE_AUTH_MODE=$VITE_AUTH_MODE \
    VITE_COGNITO_REGION=$VITE_COGNITO_REGION \
    VITE_COGNITO_USER_POOL_ID=$VITE_COGNITO_USER_POOL_ID \
    VITE_COGNITO_CLIENT_ID=$VITE_COGNITO_CLIENT_ID
RUN npm run build -w web && npm run build -w api

# --- Etapa 2: ejecución (solo dependencias de producción de la API) ------------------------------
FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    WEB_DIST=/app/web/dist
WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json api/
COPY web/package.json web/
RUN npm ci --omit=dev --workspace api && npm cache clean --force

COPY --from=build /app/api/dist api/dist
COPY --from=build /app/web/dist web/dist
COPY --chmod=755 api/docker-entrypoint.sh api/

WORKDIR /app/api
# En la imagen, los comandos de base usan el código compilado (sin tsx):
# `npm run db:migrate` es el comando de la tarea única de ECS (AWS_DEPLOY §4.5).
RUN npm pkg set scripts.db:migrate="node dist/src/db/migrate.js" \
                scripts.db:seed="node dist/src/db/seed.js" \
                scripts.start="node dist/src/server.js"

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/v1/salud').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/src/server.js"]
