# Build context is the REPO ROOT (pnpm workspace), not this directory:
#   docker build -f apps/internal-api/Dockerfile .
FROM node:24.14.0-bookworm-slim AS deploy
ENV NPM_CONFIG_FUND=false TURBO_TELEMETRY_DISABLED=1
WORKDIR /repo
RUN corepack enable
COPY . .
# CI typechecks (pnpm run typecheck); here we only transpile (tsc --noCheck).
RUN pnpm install --frozen-lockfile --filter=@api/internal...
RUN pnpm --filter=@api/internal... run build
RUN pnpm --filter=@api/internal --prod deploy --legacy /app

FROM node:24.14.0-bookworm-slim
ENV NODE_ENV=production NPM_CONFIG_FUND=false
WORKDIR /app
COPY --from=deploy /app /app
EXPOSE 3001
# --conditions=compiled resolves workspace packages to their build/ output.
CMD ["node", "--conditions=compiled", "--max-old-space-size=3072", "build/index.js"]
