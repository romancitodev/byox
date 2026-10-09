FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# La interfaz web: un sitio estático de Astro (landing en /, app en /app) que el MCP sirve desde web/dist.
FROM node:22-bookworm-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web ./
# Opcional: el link a GitHub de la landing.
ARG PUBLIC_GITHUB_URL=""
ENV PUBLIC_GITHUB_URL=$PUBLIC_GITHUB_URL
ARG PUBLIC_WAITLIST_URL=""
ENV PUBLIC_WAITLIST_URL=$PUBLIC_WAITLIST_URL
RUN npm run build

FROM node:22-bookworm-slim
# verify_course corre los tests en la imagen de cada curso con el Docker del host.
COPY --from=docker:cli /usr/local/bin/docker /usr/local/bin/docker
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=web /web/dist ./web/dist
COPY assets ./assets
EXPOSE 3333
CMD ["node", "dist/index.js"]
