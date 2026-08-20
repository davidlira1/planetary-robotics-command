#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=prod-common.sh
source "$(cd "$(dirname "$0")" && pwd)/prod-common.sh"
ensure_env_prod
ensure_tls_files

echo "Stopping the production stack for a maintenance-window deploy."
echo "Named volumes are preserved. The site will be unavailable until this script finishes."
"${COMPOSE[@]}" down
trap 'warn_stack_stopped_on_error "./scripts/prod-up.sh"' ERR

"${COMPOSE[@]}" build
"${COMPOSE[@]}" up -d postgres rabbitmq
wait_healthy prc-prod-postgres
wait_healthy prc-prod-rabbitmq
"${COMPOSE[@]}" run --rm migrate
"${COMPOSE[@]}" up -d

trap - ERR

echo ""
echo "Local production stack is up (existing data preserved; not seeded)."
echo "Open https://localhost"
