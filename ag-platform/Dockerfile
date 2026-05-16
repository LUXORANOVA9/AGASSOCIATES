# Stage 1: Dependencies
FROM node:20-bookworm-slim AS deps
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends libc6 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json turbo.json ./
RUN npm ci

# Stage 2: Build
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Runner
FROM node:20-bookworm-slim AS runner
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 reactjs

# Copy build artifacts and server.ts to serve
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

USER reactjs
EXPOSE 3000
ENV PORT 3000

# Using standard node to serve the built assets (assuming server.ts has a start mechanism or we use vite preview)
# As it's Vite + server.ts, let's run the server.ts (requires ts-node or compiled JS, assuming we can run it with node if compiled, or tsx/ts-node if installed)
CMD ["npx", "tsx", "server.ts"]
