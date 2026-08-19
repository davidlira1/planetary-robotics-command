#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=prod-common.sh
source "$(cd "$(dirname "$0")" && pwd)/prod-common.sh"
ensure_env_prod

# seed is on the init profile; a default compose build never rebuilds prc-prod-seed
"${COMPOSE[@]}" --profile init build
"${COMPOSE[@]}" up -d postgres rabbitmq
wait_healthy prc-prod-postgres
wait_healthy prc-prod-rabbitmq
"${COMPOSE[@]}" run --rm migrate
"${COMPOSE[@]}" --profile init run --rm --build seed
"${COMPOSE[@]}" up -d

echo ""
echo "Local production stack initialized."
echo "Open http://localhost"
echo "Volumes were not deleted."
