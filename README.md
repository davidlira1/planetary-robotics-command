# Planetary Robotics Command

Enterprise-oriented planetary robotics command platform.

- **Layer 1:** NestJS API, hexagonal domain/application, Prisma/PostgreSQL, telemetry ingest, fleet/telemetry reads
- **Layer 2:** Transactional outbox, Azure Service Bus (local emulator), outbox publisher, health worker, derived health + transition alerts

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

Start processes (three terminals):

```bash
pnpm dev:api            # http://localhost:3000/docs
pnpm dev:outbox         # publishes outbox → Service Bus
pnpm dev:health         # consumes health subscription
```

Or one-shot setup helper: `pnpm setup` then the three `dev:*` commands.

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

## Verify health / alerts (DB)

```bash
docker exec -it prc-postgres psql -U prc -d prc -c 'SELECT * FROM "RobotHealthState";'
docker exec -it prc-postgres psql -U prc -d prc -c 'SELECT id, type, severity, "robotId" FROM "Alert";'
docker exec -it prc-postgres psql -U prc -d prc -c 'SELECT "eventId", "publishedAt" FROM "OutboxMessage" ORDER BY "createdAt";'
```

## Service Bus emulator / DLQ

- Emulator AMQP: `localhost:5672`
- Management HTTP: `localhost:5300`
- Topic: `robot.telemetry.received` / subscription: `health`
- Connection string uses `UseDevelopmentEmulator=true` (see `.env.example`)
- Permanent consumer failures dead-letter the message; inspect via emulator tooling / Azure SDK DLQ receiver against the health subscription DLQ

## Tests

```bash
pnpm test:unit
pnpm test:integration
```

## Docs

- [docs/architecture.md](docs/architecture.md)
- [docs/adr](docs/adr)
- [specs/events](specs/events)

## Out of scope (so far)

Angular, Three.js, WebSockets, simulator, missions, commands, auth, AI, SMS/email.
