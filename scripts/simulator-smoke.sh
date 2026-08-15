#!/usr/bin/env bash
# Optional smoke: assumes API already running.
# Usage: SIMULATOR_SMOKE=1 bash scripts/simulator-smoke.sh
set -euo pipefail

if [[ "${SIMULATOR_SMOKE:-}" != "1" ]]; then
  echo "Set SIMULATOR_SMOKE=1 to run (requires live API at SIMULATOR_API_BASE_URL)."
  exit 0
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

API_URL="${SIMULATOR_API_BASE_URL:-http://localhost:3000}"
echo "Checking API live at ${API_URL}..."
curl -sf "${API_URL}/health/live" >/dev/null

BEFORE="$(docker exec prc-postgres psql -U prc -d prc -Atc 'SELECT COUNT(*) FROM "RobotTelemetry";' || echo 0)"

echo "Running simulator briefly..."
TELEMETRY_INTERVAL_MS=500 \
SIMULATION_TICK_MS=100 \
SIMULATOR_API_BASE_URL="${API_URL}" \
pnpm --filter @prc/robot-simulator start:dev >/tmp/prc-sim-smoke.log 2>&1 &
SIM_PID=$!
sleep 6
kill -INT "$SIM_PID" 2>/dev/null || true
wait "$SIM_PID" 2>/dev/null || true
sleep 1

AFTER="$(docker exec prc-postgres psql -U prc -d prc -Atc 'SELECT COUNT(*) FROM "RobotTelemetry";')"
echo "RobotTelemetry count before=${BEFORE} after=${AFTER}"

if [[ "${AFTER}" -le "${BEFORE}" ]]; then
  echo "Smoke failed: telemetry count did not increase"
  tail -n 50 /tmp/prc-sim-smoke.log || true
  exit 1
fi

echo "Smoke OK"
