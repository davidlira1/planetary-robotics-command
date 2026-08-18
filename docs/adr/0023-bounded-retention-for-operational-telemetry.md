# ADR 0023: Use bounded retention for high-volume operational telemetry

## Context

Ten robots emitting a sample every 2 seconds produce ~5 telemetry rows/s, ~18,000/hour, and ~432,000/day if history is kept forever. The same ingest path also writes outbox rows and processed-message idempotency markers. The portfolio/demo deployment does not need unbounded raw history; it does need latest fleet state, health, and alerts to survive.

## Decision

- `RobotTelemetry` is ephemeral operational data. Retain 2 hours, keyed on **ingest time** (`receivedAt`), not robot-side `recordedAt`.
- Published `OutboxMessage` rows (`publishedAt IS NOT NULL`) are retained 2 hours after publish. **Unpublished rows (`publishedAt IS NULL`) are never deleted**, regardless of age — they are durable work waiting for Service Bus.
- `ProcessedMessage` (consumer idempotency) is retained 24 hours, independently of telemetry retention, so a late redelivery is less likely to replay transition effects.
- `RobotCurrentState`, `RobotHealthState`, `Alert`, and `Robot` are not pruned by this worker.
- Cleanup runs in an isolated `apps/retention-worker` process: one cycle immediately, then every 10 minutes. Failures log and wait for the next interval. Deletes are independent `deleteMany` calls (no wrapping transaction). A single `now` is used per cycle.
- Local and future Azure cadence stay identical (`TELEMETRY_INTERVAL_MS=2000`). Retention windows are env-configurable positive integers.

At the 2-hour window the retained telemetry set is ~36,000 rows. `deleteMany` is appropriate at that volume. No `@@index([receivedAt])` is added yet: cleanup runs every 10 minutes against a bounded table. If cloud metrics later show retention deletes becoming expensive, add `@@index([receivedAt])` as the first optimization rather than redesigning the worker.

## Consequences

Database growth and Service Bus/outbox volume stay bounded for inexpensive long-running demo deployment. Telemetry history APIs naturally return only retained rows. Current state remains the latest snapshot even after history is deleted (string telemetry ids on health/alerts are not FKs).

## Alternatives considered

Indefinite raw telemetry retention — rejected; the portfolio system does not need long-term history and the unbounded volume (~432,000 telemetry rows/day) is the cost problem this worker exists to prevent. TimescaleDB / partitioning / blob archive — rejected as premature. The same 2-hour window for `ProcessedMessage` — rejected because idempotency protection should outlive telemetry history.
