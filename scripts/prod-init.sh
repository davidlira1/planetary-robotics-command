#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=prod-common.sh
source "$(cd "$(dirname "$0")" && pwd)/prod-common.sh"
ensure_env_prod

"${COMPOSE[@]}" build
"${COMPOSE[@]}" up -d postgres rabbitmq
wait_healthy prc-prod-postgres
wait_healthy prc-prod-rabbitmq
"${COMPOSE[@]}" run --rm migrate
"${COMPOSE[@]}" --profile init run --rm seed
"${COMPOSE[@]}" up -d

echo ""
echo "Local production stack initialized."
echo "Open http://localhost"
echo "Volumes were not deleted."
