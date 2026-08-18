# Planetary Robotics Command

Enterprise-oriented planetary robotics command platform.

- **Layer 1:** NestJS API, hexagonal domain/application, Prisma/PostgreSQL, telemetry ingest, fleet/telemetry reads
- **Layer 2:** Transactional outbox, Azure Service Bus (local emulator), outbox publisher, health worker, derived health + transition alerts, retention worker
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
- `pnpm dev:reset` — full fresh-development reset: volumes removed, infrastructure restarted, migrations applied, five-robot seed restored

`docker:reset` and `dev:reset` erase telemetry history, current state, health state, alerts, outbox rows, and processed-message rows. Do not use them outside local development. The retention worker is different: it continuously deletes expired history on a live database and does not replace `dev:reset`.

Default simulator cadence is one telemetry sample per robot every **2 seconds** (`TELEMETRY_INTERVAL_MS=2000`). Physics still ticks at 100 ms. Retention (defaults):

- raw telemetry — 2 hours (~18,000 rows at 5 robots × 2s; ~216,000 rows/day without retention)
- published outbox — 2 hours
- processed-message idempotency — 24 hours

Unpublished outbox rows are never deleted. Current state, health, and alerts are not pruned by retention.

The dashboard loads `/fleet` and `/alerts` once, then applies `robot.state.updated` over the live link. Header **API CONNECTED** is REST reachability; **LIVE LINK** is the WebSocket. There is no polling. Reconnect re-fetches `/fleet` and merges by `recordedAt`.

Or one-shot setup helper: `pnpm setup` then the `dev:*` commands.

### Simulator demo notes

- Default fleet: `D-04`, `H-17`, `W-08`, `M-12`, `S-03` (matches seed IDs; simulator does not import Prisma seed code).
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
