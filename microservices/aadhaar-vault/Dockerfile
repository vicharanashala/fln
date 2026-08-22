# Multi-stage Dockerfile for the Aadhaar Vault API.
#
# Stage 1: install dependencies in a clean layer.
# Stage 2: build TypeScript to ESM JavaScript.
# Stage 3: slim runtime image with only the production artifacts.
#
# Session 1 ships a buildable image so reviewers can run `docker build .`
# and confirm the toolchain works end-to-end, even before any business
# logic lands.

# ---- Stage 1: deps ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

# ---- Stage 2: build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json* tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# ---- Stage 3: runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.bin ./node_modules/.bin
EXPOSE 4101
USER node
CMD ["node", "dist/server.js"]