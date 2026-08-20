#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE=(docker compose -p prc-prod -f infrastructure/docker/docker-compose.prod.yml --env-file .env.prod)
export COMPOSE_PARALLEL_LIMIT=1

ensure_env_prod() {
  if [[ ! -f .env.prod ]]; then
    cp .env.prod.example .env.prod
    echo "Created .env.prod from .env.prod.example"
  fi
}

ensure_tls_files() {
  local cert="${ROOT}/secrets/tls/origin.crt"
  local key="${ROOT}/secrets/tls/origin.key"
  local kind=""
  local path=""

  if [[ ! -f "${cert}" ]]; then
    kind="certificate"
    path="${cert}"
  elif [[ ! -f "${key}" ]]; then
    kind="key"
    path="${key}"
  else
    return 0
  fi

  echo "error: missing TLS ${kind}:" >&2
  echo "  ${path}" >&2
  echo "" >&2
  echo "Place the Cloudflare Origin CA certificate/key under:" >&2
  echo "" >&2
  echo "  secrets/tls/origin.crt" >&2
  echo "  secrets/tls/origin.key" >&2
  echo "" >&2
  echo "before running prod:init / prod:up / prod:reset." >&2
  exit 1
}

warn_stack_stopped_on_error() {
  local rerun="$1"
  echo "error: deploy failed; the production stack is currently stopped." >&2
  echo "Postgres and RabbitMQ volumes were preserved." >&2
  echo "Inspect, fix, and rerun ${rerun}" >&2
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
