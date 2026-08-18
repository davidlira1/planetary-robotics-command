#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=prod-common.sh
source "$(cd "$(dirname "$0")" && pwd)/prod-common.sh"
ensure_env_prod

echo "WARNING: pnpm prod:reset DESTROYS the local production volumes"
echo "prc_prod_postgres_data and prc_prod_rabbitmq_data."
echo "This is not for Azure. It is a local fresh-slate only."
echo ""

"${COMPOSE[@]}" down -v
"${COMPOSE[@]}" build
"${COMPOSE[@]}" up -d postgres rabbitmq
wait_healthy prc-prod-postgres
wait_healthy prc-prod-rabbitmq
"${COMPOSE[@]}" run --rm migrate
"${COMPOSE[@]}" --profile init run --rm seed
"${COMPOSE[@]}" up -d

echo ""
echo "Local production stack reset and reinitialized."
echo "Open http://localhost"
