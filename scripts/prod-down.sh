#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=prod-common.sh
source "$(cd "$(dirname "$0")" && pwd)/prod-common.sh"
ensure_env_prod
"${COMPOSE[@]}" down
echo "Local production stack stopped. PostgreSQL and RabbitMQ volumes were preserved."
