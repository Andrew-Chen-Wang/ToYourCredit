#!/usr/bin/env bash
# Blue/green zero-downtime deploy for the internal API.
#
# Runs ON THE SERVER from /opt/toyourcredit:
#   ./deploy-api.sh <image-tag>
#
# Flow:
#   1. Read the currently active color from ./active-color (default: blue).
#   2. Persist <image-tag> as API_<INACTIVE>_TAG in ./.env (compose interpolation).
#   3. Pull + start the inactive color, wait for its container healthcheck.
#   4. Give Traefik time to health-check it into rotation.
#   5. Stop (SIGTERM -> in-app WS drain, 90s grace) and remove the old color.
#   6. Flip ./active-color.
set -euo pipefail

cd /opt/toyourcredit

if [ $# -ne 1 ]; then
  echo "Usage: $0 <image-tag>" >&2
  exit 1
fi

TAG="$1"
COMPOSE_FILE=docker-compose.production.yml
COLOR_FILE=active-color
ENV_FILE=.env
HEALTH_TIMEOUT=120

ACTIVE="blue"
if [ -f "$COLOR_FILE" ]; then
  ACTIVE="$(cat "$COLOR_FILE")"
fi
if [ "$ACTIVE" = "blue" ]; then
  INACTIVE="green"
else
  INACTIVE="blue"
fi

echo "==> Active color: $ACTIVE; deploying tag $TAG to $INACTIVE"

# Persist the tag so future `docker compose` invocations interpolate the right
# image. Compose reads ./.env in the project directory.
TAG_VAR="API_$(echo "$INACTIVE" | tr '[:lower:]' '[:upper:]')_TAG"
touch "$ENV_FILE"
if grep -q "^${TAG_VAR}=" "$ENV_FILE"; then
  sed -i "s|^${TAG_VAR}=.*|${TAG_VAR}=${TAG}|" "$ENV_FILE"
else
  echo "${TAG_VAR}=${TAG}" >> "$ENV_FILE"
fi
echo "==> Wrote ${TAG_VAR}=${TAG} to ${ENV_FILE}"

echo "==> Pulling internal-api-$INACTIVE"
docker compose -f "$COMPOSE_FILE" --profile "$INACTIVE" pull "internal-api-$INACTIVE"

echo "==> Starting internal-api-$INACTIVE"
docker compose -f "$COMPOSE_FILE" --profile "$INACTIVE" up -d "internal-api-$INACTIVE"

NEW_CONTAINER="$(docker compose -f "$COMPOSE_FILE" --profile "$INACTIVE" ps -q "internal-api-$INACTIVE")"
if [ -z "$NEW_CONTAINER" ]; then
  echo "ERROR: could not find the internal-api-$INACTIVE container" >&2
  exit 1
fi

echo "==> Waiting for internal-api-$INACTIVE to become healthy (timeout ${HEALTH_TIMEOUT}s)"
ELAPSED=0
while true; do
  STATUS="$(docker inspect -f '{{.State.Health.Status}}' "$NEW_CONTAINER" 2>/dev/null || echo unknown)"
  if [ "$STATUS" = "healthy" ]; then
    echo "==> internal-api-$INACTIVE is healthy"
    break
  fi
  if [ "$ELAPSED" -ge "$HEALTH_TIMEOUT" ]; then
    echo "ERROR: internal-api-$INACTIVE did not become healthy in ${HEALTH_TIMEOUT}s (status: $STATUS)" >&2
    echo "==> Container logs:" >&2
    docker logs "$NEW_CONTAINER" >&2 || true
    echo "==> Rolling back: removing internal-api-$INACTIVE (old color untouched)" >&2
    docker compose -f "$COMPOSE_FILE" --profile "$INACTIVE" stop "internal-api-$INACTIVE" || true
    docker compose -f "$COMPOSE_FILE" --profile "$INACTIVE" rm -f "internal-api-$INACTIVE" || true
    exit 1
  fi
  sleep 2
  ELAPSED=$((ELAPSED + 2))
done

echo "==> Sleeping 15s so Traefik health-checks add it to rotation"
sleep 15

OLD_CONTAINER="$(docker compose -f "$COMPOSE_FILE" --profile "$ACTIVE" ps -q "internal-api-$ACTIVE" || true)"
if [ -n "$OLD_CONTAINER" ]; then
  echo "==> Stopping internal-api-$ACTIVE (SIGTERM triggers in-app drain, up to 90s)"
  docker compose -f "$COMPOSE_FILE" --profile "$ACTIVE" stop "internal-api-$ACTIVE"
  docker compose -f "$COMPOSE_FILE" --profile "$ACTIVE" rm -f "internal-api-$ACTIVE"
else
  echo "==> No internal-api-$ACTIVE container running (first deploy); nothing to stop"
fi

echo "$INACTIVE" > "$COLOR_FILE"
echo "==> Deploy complete: $INACTIVE is now active (tag $TAG)"
