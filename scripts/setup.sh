#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

# Load DATABASE_URL for Prisma CLI
set -a
# shellcheck disable=SC1091
source .env
set +a

pnpm install
pnpm docker:up

echo "Waiting for Postgres..."
for i in $(seq 1 30); do
  if docker exec prc-postgres pg_isready -U prc -d prc >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

pnpm --filter @prc/persistence-prisma prisma:generate
pnpm migrate:deploy
pnpm seed
pnpm --filter @prc/domain build
pnpm --filter @prc/ports build
pnpm --filter @prc/contracts build
pnpm --filter @prc/application build
pnpm --filter @prc/persistence-prisma build
pnpm openapi:export
pnpm --filter @prc/api build

echo ""
echo "Setup complete. Run: pnpm dev"
echo "Swagger: http://localhost:3000/docs"
