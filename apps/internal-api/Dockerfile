# Build context is the REPO ROOT (pnpm workspace), not this directory:
#   docker build -f apps/internal-api/Dockerfile .
FROM node:24.14.0-bookworm-slim AS deploy
ENV NPM_CONFIG_FUND=false TURBO_TELEMETRY_DISABLED=1
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm --filter=@api/internal --prod deploy --legacy /app

FROM node:24.14.0-bookworm-slim
ENV NODE_ENV=production NPM_CONFIG_FUND=false
WORKDIR /app
COPY --from=deploy /app /app
EXPOSE 3001
CMD ["node_modules/.bin/tsx", "src/index.ts"]
