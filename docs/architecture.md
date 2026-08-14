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
              v
      Health Subscription
              │
              v
        Health Worker
              │
              v
        PostgreSQL
        Health + Alerts + ProcessedMessage
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

### Future ports (not Layer 2)

Realtime, identity, AI, notifications.
