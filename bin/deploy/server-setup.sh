#!/usr/bin/env bash
# Idempotent first-time bootstrap for the OVH production host.
# Run as the `ubuntu` user on the box (40.160.59.152):
#   ./server-setup.sh
#
# After running this script, copy the deploy artifacts to /opt/toyourcredit:
#   - docker-compose.production.yml
#   - bin/deploy/deploy-api.sh and bin/deploy/deploy-bullground.sh
#     (placed directly in /opt/toyourcredit as deploy-api.sh / deploy-bullground.sh)
#   - .env                (compose interpolation: POSTGRES_PASSWORD,
#                          VALKEY_PASSWORD, ELASTIC_PASSWORD, API_BLUE_TAG,
#                          API_GREEN_TAG, BULLGROUND_TAG)
#   - .env.production     (app runtime env, including S3_* pointing at R2)
#
# And authenticate docker to GHCR once (PAT needs read:packages):
#   docker login ghcr.io -u <github-username> -p <PAT with read:packages>
set -euo pipefail

echo "==> Bootstrapping ToYourCredit production host"

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker Engine + compose plugin via get.docker.com"
  curl -fsSL https://get.docker.com | sudo sh
else
  echo "==> Docker already installed; skipping"
fi

echo "==> Adding ubuntu to the docker group (takes effect on next login)"
sudo usermod -aG docker ubuntu

echo "==> Creating /opt/toyourcredit/letsencrypt"
sudo mkdir -p /opt/toyourcredit/letsencrypt
sudo chown -R ubuntu:ubuntu /opt/toyourcredit

echo "==> Done. Next steps:"
echo "    1. Copy docker-compose.production.yml, deploy-api.sh, deploy-bullground.sh,"
echo "       .env, and .env.production to /opt/toyourcredit"
echo "    2. docker login ghcr.io -u <github-username> -p <PAT with read:packages>"
echo "    3. Re-login (or 'newgrp docker') so the docker group applies"
