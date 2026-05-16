# Stage 1: Dependencies
FROM node:20-bookworm-slim AS deps
RUN apt-get update \
 && apt-get upgrade -y \
 && apt-get install -y --no-install-recommends libc6 \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages ./packages
RUN npm install --no-audit --no-fund

# Stage 2: Build
FROM node:20-bookworm-slim AS builder
WORKDIR /app
# Vite inlines these into the browser bundle at build time. Pass via
# `docker build --build-arg VITE_*=...` or via `build.args` in compose.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_API_BASE_URL=/api
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY . .
RUN npm run build

# Stage 3: Runtime
FROM node:20-bookworm-slim AS runner
RUN apt-get update \
 && apt-get upgrade -y \
 && apt-get install -y --no-install-recommends wget \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs reactjs

# Vite static output, Express entry + its TypeScript sources (server.ts uses
# tsx and imports .ts files from src/server/ at runtime), workspace pkgs, deps
COPY --from=builder --chown=reactjs:nodejs /app/dist ./dist
COPY --from=builder --chown=reactjs:nodejs /app/src ./src
COPY --from=builder --chown=reactjs:nodejs /app/packages ./packages
COPY --from=builder --chown=reactjs:nodejs /app/server.ts ./server.ts
COPY --from=builder --chown=reactjs:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=reactjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=reactjs:nodejs /app/node_modules ./node_modules

USER reactjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1

CMD ["npx", "tsx", "server.ts"]
