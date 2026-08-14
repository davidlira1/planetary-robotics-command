# Architecture (Layer 1)

```text
External Consumer
       │
       ▼
   HTTP Adapter (apps/api — NestJS)
       │
       ▼
Application Layer (libs/application)
       │
       ▼
Domain / Ports (libs/domain, libs/ports)
       │
       ▼
PostgreSQL Adapter (libs/infrastructure/persistence/prisma-postgres)
       │
       ▼
   PostgreSQL
```

Dependencies point inward. Domain and application code never import NestJS, Prisma, or HTTP types.

## Core concepts

| Concept | Meaning |
|---|---|
| **Robot** | Stable identity and metadata (`id`, type, model, `operationalStatus`, …). |
| **RobotCurrentState** | Latest known operational sample for efficient “where is D-04 now?” queries. At most one row per robot. |
| **RobotTelemetry** | Immutable historical observation. Never updated after insert. |

### RobotOperationalStatus vs future RobotHealthStatus

`RobotOperationalStatus` (`OFFLINE | IDLE | ACTIVE | CHARGING | FAULTED`) describes what the robot is **operationally doing**.

A future `RobotHealthStatus` (`HEALTHY | WARNING | CRITICAL`) will describe **telemetry-derived health**. These concepts must not be conflated. Health processing is **not** implemented in Layer 1.

## Telemetry ingestion

`POST /api/v1/telemetry` returns **202 Accepted** only after the Layer 1 transaction has **durably completed** (append history + conditional current-state update, or idempotent same-payload path). 202 means accepted into the system with possible future async processing (events/health) — not that persistence is still pending.

### Ordering / current state

- `recordedAt` is the **sole chronological authority** for current-state ordering.
- Current state updates only when incoming `recordedAt` is **strictly greater** than stored.
- Equal `recordedAt`: existing current state wins (no `receivedAt` / `telemetryId` tie-break).
- History may still store multiple observations with the same `recordedAt` if `sourceTelemetryId`s differ.

### Idempotency

Unique `(robotId, sourceTelemetryId)`:

- Same producer key + same observation content → **202** with existing `telemetryId`.
- Same producer key + conflicting content → **409 `IDEMPOTENCY_CONFLICT`**.

### schemaVersion

Required integer. Layer 1 supports `schemaVersion = 1` only. Stored on each telemetry row and returned in history responses so future contract evolution does not assume every historical row has the newest shape.

## Contracts

Executable source of truth: Zod schemas in `libs/contracts`.

```text
libs/contracts → runtime validation → OpenAPI generation → specs/openapi/openapi.v1.yaml
```

The YAML is a versioned language-neutral artifact (for Angular/.NET/Python clients and alternate backends). Do not hand-edit it independently; use `pnpm openapi:export` / `pnpm openapi:check`.

## Pagination

- Fleet (`GET /api/v1/robots`): order by `id` ASC; default limit 50; max 200; cursor encodes last `id`.
- Telemetry history: order by `(recordedAt, telemetryId)` ASC or DESC; cursor encodes both; default limit 100; max 500.

## Operational endpoints

Outside `/api/v1`:

- `GET /health/live` — process up
- `GET /health/ready` — PostgreSQL reachable

## Future extension ports (not implemented)

Messaging (`EventPublisher`), realtime, identity, AI provider, notification.

Event envelope convention: see `specs/events/README.md`.
