#!/usr/bin/env bash
# Deploy the bullground BullMQ worker.
#
# Runs ON THE SERVER from /opt/toyourcredit:
#   ./deploy-bullground.sh <image-tag>
#
# Simple recreate: compose stops the old container (SIGTERM -> graceful drain,
# up to 600s stop_grace_period; the worker has a 9.5-minute drain built in)
# and starts the new one.
set -euo pipefail

cd /opt/toyourcredit

if [ $# -ne 1 ]; then
  echo "Usage: $0 <image-tag>" >&2
  exit 1
fi

TAG="$1"
COMPOSE_FILE=docker-compose.production.yml
ENV_FILE=.env

# Persist the tag for compose variable interpolation (compose reads ./.env).
touch "$ENV_FILE"
if grep -q "^BULLGROUND_TAG=" "$ENV_FILE"; then
  sed -i "s|^BULLGROUND_TAG=.*|BULLGROUND_TAG=${TAG}|" "$ENV_FILE"
else
  echo "BULLGROUND_TAG=${TAG}" >> "$ENV_FILE"
fi
echo "==> Wrote BULLGROUND_TAG=${TAG} to ${ENV_FILE}"

echo "==> Pulling bullground"
docker compose -f "$COMPOSE_FILE" pull bullground

echo "==> Recreating bullground (graceful drain of old container, up to 600s)"
docker compose -f "$COMPOSE_FILE" up -d bullground

echo "==> Deploy complete: bullground is running tag $TAG"
