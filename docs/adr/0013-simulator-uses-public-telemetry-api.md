# ADR 0013: Simulator uses the public telemetry API

## Context

The fleet simulator could write PostgreSQL directly, invoke `IngestTelemetry` in-process, or publish to Service Bus.

## Decision

The simulator behaves as an external telemetry producer and calls `POST /api/v1/telemetry` through an HTTP adapter implementing a transport-neutral `TelemetryProducer` port (`TelemetrySample`).

## Consequences

- Exercises validation, idempotency, persistence, outbox, Service Bus, and health end-to-end.
- Clean replaceability by real devices or a device gateway.
- Slightly more overhead than in-process use-case calls; acceptable for Layer 3.

## Alternatives considered

Direct DB writes / in-process use case — rejected (bypasses the device-ingestion boundary).
