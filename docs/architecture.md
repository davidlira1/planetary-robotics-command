# Architecture

## Layer 1 — HTTP + persistence

```text
External Consumer
       │
       ▼
   HTTP Adapter (apps/api)
       │
       ▼
Application Layer
       │
       ▼
Domain / Ports
       │
       ▼
PostgreSQL Adapter
       │
       ▼
   PostgreSQL
```

## Layer 2 — messaging + health

```text
Telemetry API
      │
      v
PostgreSQL Transaction
      │
      +---- Telemetry
      +---- Current State
      +---- Outbox
              │
              v
        Outbox Publisher
        (short claim txn, then publish outside DB)
              │
              v
      Azure Service Bus topic
      robot.telemetry.received
              │
              +---- health subscription → Health Worker → PostgreSQL health/alerts
              +---- realtime subscription → Realtime Gateway → WebSocket (Layer 6)
```

### Why the API does not publish directly

DB and Service Bus cannot share one local transaction. The API writes an outbox row atomically with telemetry. The publisher owns broker delivery.

### Outbox claim window

`FOR UPDATE SKIP LOCKED` runs only while claiming. Broker I/O is outside any open PostgreSQL transaction. If publish succeeds and the process crashes before `markPublished`, republish of the same `eventId` is expected (at-least-once). Consumers use inbox idempotency.

### Health vs operational status

- `RobotOperationalStatus` — what the robot is doing
- `RobotHealthStatus` — derived telemetry health (`HEALTHY` / `WARNING` / `CRITICAL`)

Raw `RobotCurrentState` stays factual; `RobotHealthState` is interpretation.

### Messaging portability

Azure Service Bus lives under `@prc/messaging-asb`. Application/health logic depends on `EventPublisher` and repositories only. Kafka/RabbitMQ would be new adapters.

### Telemetry lifecycle and retention

```text
Robot / simulator sends telemetry (every 2s)
      ↓
Ingest API writes history + current state + outbox
      ↓
RobotTelemetry history retained temporarily (2 hours, by receivedAt)
RobotCurrentState remains the latest authoritative snapshot
      ↓
Retention Worker removes expired history, published outbox (2h),
and processed-message rows (24h)
```

Raw telemetry history is intentionally ephemeral in the demo deployment. Operational current state, health, and alerts are stored separately and are not deleted by this worker. Unpublished outbox rows (`publishedAt IS NULL`) are never deleted. See ADR 0023.

Five robots at a 2-second cadence produce ~216,000 telemetry rows/day without retention; the 2-hour window keeps ~18,000.

## Layer 3 — simulated robot fleet

```text
Simulated Robot Fleet
(@prc/simulation + apps/robot-simulator)
        |
        | TelemetryProducer (transport-neutral TelemetrySample)
        v
HttpTelemetryProducer
        |
        | HTTP POST /api/v1/telemetry
        v
Telemetry API
        |
        v
existing Layer 1/2 pipeline
(outbox → Service Bus → health worker)
```

### Why the simulator uses HTTP

The simulator represents an external device/gateway. It must not write PostgreSQL, append to Service Bus, or import Prisma. Calling the public ingest API exercises the same path a real robot fleet would use and keeps the simulator replaceable later.

### Coordinate conventions

Cartesian meters: `x` east/west, `z` north/south, `y` altitude (Three.js-friendly). Ground robots stay near `y = 0`; drones operate with `y > 0`.

### Tick vs telemetry / backpressure

Physics uses actual monotonic `deltaTime` (clamped). Telemetry emission is a separate interval (default 2000 ms) that freezes an immutable `TelemetrySample` before send. Each robot allows at most one in-flight send; overlapping intervals skip rather than queue unboundedly. Retries reuse the same snapshot.

## Layer 4 — dashboard read models

```text
Angular + Three.js (Layer 5)
        |
        v
Dashboard Read API
  GET /api/v1/fleet
  GET /api/v1/robots/:id   (+ health)
  GET /api/v1/alerts
  GET /api/v1/robots/:id/telemetry
        |
        +--> FleetReadRepository (application read models)
        +--> AlertRepository.list
        +--> RobotHealthRepository.findByRobotId
        |
        v
PostgreSQL
```

Layer 4 composes Robot + RobotCurrentState + RobotHealthState for UI bootstrapping. It does not alter telemetry ingestion, outbox, or health-worker write paths. `currentState` and `health` may be null when no data exists yet.

## Layer 5 — Angular command dashboard

```text
Angular UI
    ↓
FleetFacade / AlertsFacade / InspectionFacade
    ↓
Data-source interfaces
    ↓
HTTP adapters
    ↓
Generated OpenAPI Angular client
    ↓
PRC REST API (dev proxy 4200 → 3000)
```

Visualization:

```text
FleetFacade state
    ↓
RobotWorldHostComponent
    ↓
RobotWorld (ROBOT_WORLD token)
    ↓
ThreeRobotWorld
```

Layer 5 loads `GET /api/v1/fleet` once and `GET /api/v1/alerts?status=OPEN&limit=50` once, then keeps robot current-state fresh over WebSocket (Layer 6). Facades expose HTTP loads as `Observable<void>` workflows; the shell subscribes with `takeUntilDestroyed`. Fleet, alerts, inspection, and realtime facades are shell-scoped. There is no polling. Header shows **API CONNECTED** (REST reachability) and **LIVE LINK** (WebSocket state) separately.

`InspectionFacade` is presentation-only (`openAsset()` / `toggleAsset()` / `openAlert(id)` / `close()`). It owns drawer mode and selected alert id, not selected robot identity. Closing the drawer does not clear fleet selection. Fleet row click selects only (no camera focus, no drawer). A 3D model or label click selects via `FleetFacade` and focuses with `focusRobot` on first click; a later click of the same selected robot toggles the asset drawer. Clicking a different robot closes any open asset drawer and does not reopen it. Alert click selects the robot and opens alert detail. The inspector is a non-modal right-side panel: the dashboard is not `inert` and is not blurred. Facade state is read-only to consumers.

Responsive modes: full command (≥1440px), compact command (1024–1439px), focus (<1024px: fleet + world primary; telemetry/alerts via the drawer). Desktop/laptop-first.

## Layer 6 — realtime fleet streaming

```text
Simulator
    ↓ POST /telemetry
API (outbox in the same Postgres transaction)
    ↓
Outbox Publisher
    ↓
Azure Service Bus topic
robot.telemetry.received
    ├── health subscription → Health Worker → Postgres health/alerts
    └── realtime subscription → Realtime Gateway
                                    ↓ maps to robot.state.updated
                                 WebSocket /realtime
                                    ↓
                         Angular FleetRealtimeDataSource
                                    ↓
                              FleetFacade patch
                                    ↓
                         presentation-only Three.js motion
```

REST answers "what is true when I connect / reconnect." The socket answers "what changed after I connected." `POST /telemetry` does not talk to WebSockets. The gateway does not write Postgres.

## Out of scope (later layers)

Identity, AI, notifications, missions/commands, realtime alerts / health-changed events.
