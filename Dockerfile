# Immagine di produzione di services/engine (Fly.io). Build context: radice del monorepo.
FROM node:20-bookworm-slim AS build
RUN corepack enable
# Toolchain per compilare better-sqlite3 se non c'è un binario precompilato.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
COPY . .
# Solo l'engine e le sue dipendenze di workspace (packages/shared): l'app mobile non viene installata.
RUN pnpm install --frozen-lockfile --filter "@seeker-signal/engine..."
RUN pnpm --filter @seeker-signal/engine deploy --prod /out

FROM node:20-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out .
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
# @seeker-signal/shared è sorgente TypeScript: l'engine gira con tsx anche in produzione.
CMD ["node", "--import", "tsx", "src/index.ts"]
