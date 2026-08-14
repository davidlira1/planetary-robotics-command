# ADR 0007: Telemetry idempotency via sourceTelemetryId

## Context

Devices/simulators may retry after lost acknowledgements.

## Decision

Require producer `sourceTelemetryId`. Enforce unique `(robotId, sourceTelemetryId)`. Same content → 202 idempotent success with existing `telemetryId`. Conflicting content → 409 `IDEMPOTENCY_CONFLICT`. Persist `schemaVersion` (Layer 1 = 1) for future evolution.

## Consequences

Safe retries without duplicate history; conflicts are explicit, never silently overwritten.

## Alternatives considered

Always insert new rows — rejected (duplicates). Treat all duplicates as errors — rejected (breaks legitimate retries).
