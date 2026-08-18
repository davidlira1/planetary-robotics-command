#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE=(docker compose -p prc-prod -f infrastructure/docker/docker-compose.prod.yml --env-file .env.prod)

ensure_env_prod() {
  if [[ ! -f .env.prod ]]; then
    cp .env.prod.example .env.prod
    echo "Created .env.prod from .env.prod.example"
  fi
}

wait_healthy() {
  local name="$1"
  local deadline=$((SECONDS + 90))
  echo "Waiting for ${name} to become healthy..."
  while true; do
    if ! docker inspect "${name}" >/dev/null 2>&1; then
      echo "error: container ${name} is missing" >&2
      exit 1
    fi
    local status
    status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${name}" 2>/dev/null || true)"
    if [[ "${status}" == "healthy" ]]; then
      return 0
    fi
    if (( SECONDS >= deadline )); then
      echo "error: ${name} did not become healthy within 90s (status=${status:-unknown})" >&2
      exit 1
    fi
    sleep 2
  done
}
