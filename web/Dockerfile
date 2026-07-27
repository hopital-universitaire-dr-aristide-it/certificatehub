# docker/web — build de production du frontend React (Vite)
# Ce Dockerfile ne fait que produire les assets statiques (dist/).
# En prod, nginx (voir docker-compose.yml) sert directement ./web/dist en bind mount.
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM scratch AS export
COPY --from=build /app/dist /
