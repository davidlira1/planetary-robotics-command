#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=prod-common.sh
source "$(cd "$(dirname "$0")" && pwd)/prod-common.sh"
ensure_env_prod
# include init-profile seed; default compose build omits prc-prod-seed
"${COMPOSE[@]}" --profile init build "$@"
