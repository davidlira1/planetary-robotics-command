#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "WARNING: pnpm dev:reset is for LOCAL development only."
echo "This deletes Docker volumes, including prc_postgres_data."
echo "Telemetry history, current state, health state, alerts, outbox rows,"
echo "and processed-message rows will be erased."
echo "The Service Bus emulator will also restart from Config.json."
echo ""

pnpm docker:reset

echo "Waiting for Postgres to become healthy..."
deadline=$((SECONDS + 60))
while true; do
  if ! docker inspect prc-postgres >/dev/null 2>&1; then
    echo "error: container prc-postgres is missing after docker:reset" >&2
    exit 1
  fi
  status="$(docker inspect -f '{{.State.Health.Status}}' prc-postgres 2>/dev/null || true)"
  if [[ "${status}" == "healthy" ]]; then
    break
  fi
  if (( SECONDS >= deadline )); then
    echo "error: Postgres did not become healthy within 60s (status=${status:-unknown})" >&2
    exit 1
  fi
  sleep 1
done

pnpm migrate
pnpm seed

echo ""
echo "Local PRC environment reset successfully."
echo "Database migrated and five robots seeded."
