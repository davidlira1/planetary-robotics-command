#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=prod-common.sh
source "$(cd "$(dirname "$0")" && pwd)/prod-common.sh"
ensure_env_prod
ensure_tls_files
"${COMPOSE[@]}" up -d --build

echo ""
echo "Local production stack is up (existing data preserved; not seeded)."
echo "Open http://localhost"
