#!/usr/bin/env bash
# Single deployment entrypoint. Runs prod DB migrations, then deploys the
# requested service(s) on the OVH host. Called by the GitHub Actions deploy
# workflows, and runnable from a laptop with the repo checked out.
#
# Usage:
#   bin/deploy/deploy.sh <api|bullground|all> <image-tag>
#
# Environment:
#   DATABASE_URL      Prod connection string for migrations (public port).
#                     Required unless SKIP_MIGRATIONS=1. On a laptop:
#                     source it from .env.prod.
#   SKIP_MIGRATIONS   Set to 1 to skip the migration step.
#   GHCR_TOKEN        Optional token with read:packages; when set, the server
#                     is logged into GHCR before pulling (CI passes the
#                     ephemeral GITHUB_TOKEN). Without it the server reuses
#                     its last docker login, which may have expired.
#   GHCR_USER         Username for the GHCR login (default: the git remote
#                     owner, andrew-chen-wang).
#   SSH_KEY           SSH key path (default ~/.ssh/id_ovh_toyourcredit if it
#                     exists, else ssh defaults, e.g. CI's ~/.ssh/id_ed25519).
#   SERVER            Default ubuntu@40.160.59.152.
set -euo pipefail

if [ $# -ne 2 ]; then
  echo "Usage: $0 <api|bullground|all> <image-tag>" >&2
  exit 1
fi

TARGET="$1"
TAG="$2"
case "$TARGET" in api | bullground | all) ;; *)
  echo "Unknown target '$TARGET' (expected api, bullground, or all)" >&2
  exit 1
  ;;
esac

SERVER="${SERVER:-ubuntu@40.160.59.152}"
GHCR_USER="${GHCR_USER:-andrew-chen-wang}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

SSH_ARGS=()
if [ -n "${SSH_KEY:-}" ]; then
  SSH_ARGS+=(-i "$SSH_KEY")
elif [ -f "$HOME/.ssh/id_ovh_toyourcredit" ]; then
  SSH_ARGS+=(-i "$HOME/.ssh/id_ovh_toyourcredit")
fi
run_remote() { ssh "${SSH_ARGS[@]}" -o BatchMode=yes "$SERVER" "$@"; }

# --- 1. Migrations -----------------------------------------------------------
# Blue/green keeps the old color serving against the new schema during the
# flip, so migrations must stay backward-compatible (expand -> contract).
if [ "${SKIP_MIGRATIONS:-0}" = "1" ]; then
  echo "==> Skipping migrations (SKIP_MIGRATIONS=1)"
else
  if [ -z "${DATABASE_URL:-}" ]; then
    echo "ERROR: DATABASE_URL is required to run migrations (or set SKIP_MIGRATIONS=1)" >&2
    exit 1
  fi
  echo "==> Running prod migrations"
  (cd "$REPO_ROOT" && DATABASE_URL="$DATABASE_URL" pnpm --filter dbmigrator run migrate:latest)
fi

# --- 2. GHCR login on the server (optional) ----------------------------------
if [ -n "${GHCR_TOKEN:-}" ]; then
  echo "==> Logging the server into GHCR as $GHCR_USER"
  printf '%s' "$GHCR_TOKEN" | run_remote "docker login ghcr.io -u $GHCR_USER --password-stdin"
fi

# --- 3. Deploy ---------------------------------------------------------------
if [ "$TARGET" = "api" ] || [ "$TARGET" = "all" ]; then
  echo "==> Deploying internal-api (blue/green, tag $TAG)"
  run_remote "cd /opt/toyourcredit && ./deploy-api.sh $TAG"
fi
if [ "$TARGET" = "bullground" ] || [ "$TARGET" = "all" ]; then
  echo "==> Deploying bullground (graceful recreate, tag $TAG)"
  run_remote "cd /opt/toyourcredit && ./deploy-bullground.sh $TAG"
fi

echo "==> Deploy finished: $TARGET @ $TAG"
