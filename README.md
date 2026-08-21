# Planetary Robotics Command

Enterprise-oriented planetary robotics command platform.

- **Layer 1:** NestJS API, hexagonal domain/application, Prisma/PostgreSQL, telemetry ingest, fleet/telemetry reads
- **Layer 2:** Transactional outbox, Azure Service Bus (local `dev:*` emulator) or RabbitMQ (local production Compose), outbox publisher, health worker, derived health + transition alerts, retention worker
- **Layer 3:** Robot fleet simulator posting believable telemetry through the public HTTP API
- **Layer 4:** Dashboard read models — `GET /fleet`, alerts list, health on robot detail
- **Layer 5:** Angular 22 command dashboard + Three.js world
- **Layer 6:** Realtime fleet current-state over WebSocket (`apps/realtime-gateway`, Service Bus `realtime` subscription)

## Prerequisites

- Node.js 20+
- pnpm 9 (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)
- Docker Desktop

## Quick start

```bash
cp .env.example .env
pnpm install
pnpm docker:up          # Postgres + Service Bus emulator (+ SQL Edge)
pnpm --filter @prc/persistence-prisma prisma:generate
pnpm migrate:deploy
pnpm seed
pnpm build
```

Start processes (eight terminals for full pipeline + simulator + live dashboard):

```bash
pnpm docker:up          # Terminal 1 (if not already running)
pnpm dev:api            # Terminal 2 — http://localhost:3000/docs
pnpm dev:outbox         # Terminal 3 — publishes outbox → Service Bus
pnpm dev:health         # Terminal 4 — consumes health subscription
pnpm dev:realtime       # Terminal 5 — WebSocket gateway :3001/realtime
pnpm dev:retention      # Terminal 6 — bounds telemetry / published outbox / processed-message growth
pnpm dev:simulator      # Terminal 7 — fleet telemetry via HTTP (every 2s by default)
pnpm dev:dashboard      # Terminal 8 — http://localhost:4200 (proxies /api, /health → :3000 and /realtime WS → :3001)
```

After editing `infrastructure/docker/servicebus/Config.json`, recreate the Service Bus emulator container so the `realtime` subscription exists (`pnpm docker:down && pnpm docker:up`).

Local Docker data:

- `pnpm docker:down` — stops/removes containers but **preserves** the Postgres named volume `prc_postgres_data`
- `pnpm docker:reset` — **destroys** local Docker volumes and recreates infrastructure (local only)
- `pnpm dev:reset` — full fresh-development reset: volumes removed, infrastructure restarted, migrations applied, ten-robot seed restored

`docker:reset` and `dev:reset` erase telemetry history, current state, health state, alerts, outbox rows, and processed-message rows. Do not use them outside local development. The retention worker is different: it continuously deletes expired history on a live database and does not replace `dev:reset`.

Default simulator cadence is one telemetry sample per robot every **2 seconds** (`TELEMETRY_INTERVAL_MS=2000`). Physics still ticks at 100 ms. Retention (defaults):

- raw telemetry — 2 hours (~36,000 rows at 10 robots × 2s; ~432,000 rows/day without retention)
- published outbox — 2 hours
- processed-message idempotency — 24 hours

Unpublished outbox rows are never deleted. Current state, health, and alerts are not pruned by retention.

The dashboard loads `/fleet` and `/alerts` once, then applies `robot.state.updated` over the live link. Header **API CONNECTED** is REST reachability; **LIVE LINK** is the WebSocket. There is no polling. Reconnect re-fetches `/fleet` and merges by `recordedAt`.

Or one-shot setup helper: `pnpm setup` then the `dev:*` commands.

## Local production stack

One Compose topology (Nginx + Postgres + RabbitMQ + API + workers + simulator). Cursor acceptance is `https://localhost` after `pnpm prod:up` (HTTP on port 80 redirects to HTTPS). RabbitMQ and Postgres are not published on the host. Production images use Node 24.15. This is also the file a later Azure VM would run; this repo does not provision Azure. HTTPS uses a host-supplied Cloudflare Origin CA cert/key under `secrets/tls/` (not in Git).

`.env.prod` stores primitive credentials once (`POSTGRES_*`, `RABBITMQ_USER` / `RABBITMQ_PASSWORD`). Compose derives `DATABASE_URL` and `RABBITMQ_URL` for the containers. Do not duplicate passwords into connection strings. Generate production passwords as hex so they are safe in URI userinfo (no `@ : / # ?`):

```bash
cp .env.prod.example .env.prod   # first time
openssl rand -hex 24             # POSTGRES_PASSWORD
openssl rand -hex 24             # RABBITMQ_PASSWORD
# edit .env.prod — set those two values; delete leftover DATABASE_URL / RABBITMQ_URL if present
pnpm prod:init                   # first-time create: migrate + seed + start
# later:
pnpm prod:up                     # start/update; migrate; do not seed
pnpm prod:down                   # stop; keep volumes
pnpm prod:logs
pnpm prod:reset                  # DESTROYS prc_prod_* volumes, then re-inits
```

| Command | Meaning |
|---------|---------|
| `prod:init` | First-time (or re-init). Stops containers if running, **keeps volumes**, default Compose build, migrate, **seed**, start. |
| `prod:up` | Maintenance-window update. Stops containers, **keeps volumes**, default Compose build, migrate, start. **Does not seed.** |
| `prod:down` | Stop containers/networks. **Keeps** Postgres and RabbitMQ volumes. |
| `prod:reset` | Destroy `prc_prod_postgres_data` and `prc_prod_rabbitmq_data`, then the same as init. |

RabbitMQ transient failures retry with a 2s delay, max 10 deliveries, then dead-letter (`RABBITMQ_MAX_DELIVERY_COUNT`, `RABBITMQ_RETRY_TTL_MS`). Permanent validation failures dead-letter immediately.

Manual check after `pnpm prod:up`: Angular at `/`, `/api/v1/fleet`, `/health/live`, WebSocket `/realtime` (`wss:` when the page is HTTPS), ten robots, 2s telemetry, `prod:down` then `prod:up` restores state. No Angular dev proxy. After adding seed robots, use `pnpm seed` or `pnpm dev:reset` locally; `prod:up` does not re-seed.

`prod:*` volumes are **not** `prc_postgres_data` (that one belongs to `pnpm docker:up`).

On small hosts (2 vCPU / 4 GB), `prod:up` uses a short **maintenance window**: it stops current containers (`docker compose down`, no `-v`), then runs a normal Compose build (default concurrency), migrates, and starts the stack. Building after the runtime is stopped is what keeps the VM stable; this favors deploy stability over zero downtime. If build or migrate fails after the stop, the script exits non-zero and the previous stack stays down; volumes remain; rerun `./scripts/prod-up.sh` after fixing. `prod:init` also stops first without deleting volumes so a re-init does not build on a live stack.

## Fresh production host

Prepare a disposable Ubuntu 22.04+ VM for the existing Compose stack. The VM stays disposable; this repository is the source of truth after clone. Do not install Node, PostgreSQL, RabbitMQ, or Nginx on the host.

Git has two roles:

1. **Pre-bootstrap:** install Git manually only if it is missing, so the private repo can be cloned.
2. **Bootstrap invariant:** `bootstrap-host.sh` still installs Git so a fully bootstrapped host always has Git, Docker Engine, and Docker Compose.

```bash
# 1. SSH into the new Ubuntu host
# 2. Install Git only if it is not already present:
sudo apt-get update
sudo apt-get install -y git

# 3. Create a VM-specific GitHub SSH/deploy key. Add the PUBLIC key to GitHub.
#    Do not copy a developer's personal private key onto the VM.

git clone git@github.com:davidlira1/planetary-robotics-command.git
cd planetary-robotics-command

./scripts/bootstrap-host.sh

# Reconnect SSH if docker-group membership was added.

cp .env.prod.example .env.prod   # never commit this file
openssl rand -hex 24             # paste into POSTGRES_PASSWORD
openssl rand -hex 24             # paste into RABBITMQ_PASSWORD
# Compose derives DATABASE_URL and RABBITMQ_URL. Do not add those keys.

mkdir -p secrets/tls
chmod 700 secrets/tls
# Operator securely copies the Cloudflare Origin CA certificate and private key:
#   secrets/tls/origin.crt
#   secrets/tls/origin.key
chmod 644 secrets/tls/origin.crt
chmod 600 secrets/tls/origin.key

./scripts/prod-init.sh
```

Public acceptance: `https://robotfleet.davlira.dev`. HTTP on port 80 redirects to HTTPS; 443 serves the app. Cloudflare SSL/TLS mode must be **Full (strict)** so Cloudflare validates the Origin CA certificate. `bootstrap-host.sh` does not generate or copy TLS files.

This repo does not enable UFW or change provider firewalls/NSGs. Externally accessible ports that must be allowed outside this repository:

| Port | Use |
|------|-----|
| 22 | SSH |
| 80 | HTTP (redirects to HTTPS) |
| 443 | HTTPS |

| Command | Meaning |
|---------|---------|
| `./scripts/bootstrap-host.sh` | Prepare a new Linux machine: Git, Docker Engine, Docker Compose. Idempotent. Does not start the application. |
| `./scripts/check-host.sh` | Read-only host diagnostics (no installs). |
| `./scripts/prod-init.sh` / `pnpm prod:init` | First-time application init: stop if running (keep volumes), default Compose build, migrate, seed, start. |
| `./scripts/prod-up.sh` / `pnpm prod:up` | Maintenance-window update: stop (keep volumes), default Compose build, migrate, start. Does not seed. |
| `./scripts/prod-down.sh` / `pnpm prod:down` | Stop containers. Keeps volumes. |
| `./scripts/prod-reset.sh` / `pnpm prod:reset` | Destroy application volumes, then the same as init. |

On the VM, call the scripts directly (Node/pnpm are not installed on the host). Laptop `pnpm prod:*` wrappers remain for local Docker Desktop.

Re-run `bootstrap-host.sh` to refresh host tools. Use `prod:reset` only to destroy and recreate application data.

### Simulator demo notes

- Default fleet: `D-04`, `D-09`, `H-17`, `H-22`, `W-08`, `W-14`, `M-12`, `M-27`, `S-03`, `S-11` (matches seed IDs; simulator does not import Prisma seed code).
- Telemetry emission: every 2 seconds (`TELEMETRY_INTERVAL_MS`). Simulation physics tick stays 100 ms.
- Optional threshold scenario: set `SIM_D04_BATTERY=19` in `.env` to start the drone near the battery WARNING band.
- Deterministic runs: set `SIMULATION_SEED=12345`.
- Debug tick skips: `SIMULATOR_DEBUG=1`.

## Example telemetry

Healthy:

```bash
curl -s -X POST http://localhost:3000/api/v1/telemetry \
  -H 'Content-Type: application/json' \
  -d '{"sourceTelemetryId":"demo-h1","robotId":"D-04","schemaVersion":1,"recordedAt":"2026-08-14T20:00:00.000Z","position":{"x":1,"y":2,"z":3},"batteryPercent":82,"temperatureCelsius":40,"signalStrengthDbm":-70,"velocityMetersPerSecond":1,"headingDegrees":10}'
```

Warning battery (19%):

```bash
curl -s -X POST http://localhost:3000/api/v1/telemetry \
  -H 'Content-Type: application/json' \
  -d '{"sourceTelemetryId":"demo-w1","robotId":"D-04","schemaVersion":1,"recordedAt":"2026-08-14T20:01:00.000Z","position":{"x":1,"y":2,"z":3},"batteryPercent":19,"temperatureCelsius":40,"signalStrengthDbm":-70,"velocityMetersPerSecond":1,"headingDegrees":10}'
```

Critical battery (8%):

```bash
curl -s -X POST http://localhost:3000/api/v1/telemetry \
  -H 'Content-Type: application/json' \
  -d '{"sourceTelemetryId":"demo-c1","robotId":"D-04","schemaVersion":1,"recordedAt":"2026-08-14T20:02:00.000Z","position":{"x":1,"y":2,"z":3},"batteryPercent":8,"temperatureCelsius":40,"signalStrengthDbm":-70,"velocityMetersPerSecond":1,"headingDegrees":10}'
```

## Dashboard read examples (Layer 4)

Fleet snapshot (3D viewport bootstrap):

```bash
curl -s http://localhost:3000/api/v1/fleet | jq .
```

Robot detail (includes `health`, which may be `null`):

```bash
curl -s http://localhost:3000/api/v1/robots/D-04 | jq .
```

Open alerts (newest first; optional `robotId`, `severity`, `status`, `limit`, `cursor`):

```bash
curl -s 'http://localhost:3000/api/v1/alerts?status=OPEN&limit=20' | jq .
```

## Verify health / alerts (DB)

```bash
docker exec -it prc-postgres psql -U prc -d prc -c 'SELECT * FROM "RobotHealthState";'
docker exec -it prc-postgres psql -U prc -d prc -c 'SELECT id, type, severity, "robotId" FROM "Alert";'
docker exec -it prc-postgres psql -U prc -d prc -c 'SELECT "eventId", "publishedAt" FROM "OutboxMessage" ORDER BY "createdAt";'
```

After the simulator has run for several seconds:

```bash
docker exec -it prc-postgres psql -U prc -d prc -c 'SELECT COUNT(*) FROM "RobotTelemetry";'
docker exec -it prc-postgres psql -U prc -d prc -c 'SELECT "robotId", "batteryPercent", "recordedAt" FROM "RobotCurrentState";'
docker exec -it prc-postgres psql -U prc -d prc -c 'SELECT "consumerName", COUNT(*) FROM "ProcessedMessage" GROUP BY "consumerName";'
```

## Service Bus emulator / DLQ

- Emulator AMQP: `localhost:5672`
- Management HTTP: `localhost:5300`
- Topic: `robot.telemetry.received` / subscriptions: `health`, `realtime`
- Realtime gateway: `http://localhost:3001/realtime` (dashboard proxies `/realtime`)
- Connection string uses `UseDevelopmentEmulator=true` (see `.env.example`)
- Permanent consumer failures dead-letter the message; inspect via emulator tooling / Azure SDK DLQ receiver against the health or realtime subscription DLQ
- Local production (`pnpm prod:up`) uses RabbitMQ instead; DLQs are `robot.telemetry.received.health.dlq` and `robot.telemetry.received.realtime.dlq` inside the broker (no host ports)

## Tests

```bash
pnpm test:unit
pnpm test:integration
pnpm test:dashboard
pnpm api:check:angular
```

Regenerate the Angular OpenAPI client after contract changes (`Docker` image `openapitools/openapi-generator-cli:v7.24.0`):

```bash
pnpm api:generate:angular
```

## Editor

Open [`prc.code-workspace`](prc.code-workspace) rather than the repo folder. The backend stays on workspace TypeScript 5.x; the Angular dashboard uses its own TypeScript 6.x. Install the recommended **Angular Language Service** (`Angular.ng-template`) so dashboard templates typecheck.

## Docs

- [docs/architecture.md](docs/architecture.md)
- [docs/adr](docs/adr)
- [specs/events](specs/events)
- [specs/realtime](specs/realtime)

## Out of scope (so far)

Missions, commands, auth, AI, SMS/email, realtime alerts, full mobile product design.
