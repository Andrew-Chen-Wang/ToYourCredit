# Build context is the REPO ROOT (pnpm workspace), not this directory:
#   docker build -f apps/bullground/Dockerfile .
FROM node:24.14.0-bookworm-slim AS deploy
ENV NPM_CONFIG_FUND=false TURBO_TELEMETRY_DISABLED=1
WORKDIR /repo
RUN corepack enable
COPY . .
# CI typechecks (pnpm run typecheck); here we only transpile (tsc --noCheck).
RUN pnpm install --frozen-lockfile --filter=bullground...
RUN pnpm --filter=bullground... run build
RUN pnpm --filter=bullground --prod deploy --legacy /app

FROM node:24.14.0-bookworm-slim
ENV NODE_ENV=production NPM_CONFIG_FUND=false
# ffmpeg is required for HLS encoding jobs.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deploy /app /app
# --conditions=compiled resolves workspace packages to their build/ output.
# 4 GiB heap: the container limit is 6 GiB, shared with ffmpeg child processes.
CMD ["node", "--conditions=compiled", "--max-old-space-size=4096", "build/index.js"]
