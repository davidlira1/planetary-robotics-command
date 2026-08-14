# ADR 0005: Use cursor pagination

## Context

Telemetry history and fleet lists must not allow unbounded offset scans.

## Decision

- Fleet: cursor on `id` ASC; default limit 50; max 200.
- Telemetry: compound order `(recordedAt, telemetryId)`; cursor encodes both; default limit 100; max 500.

## Consequences

Stable paging under inserts; opaque cursors; invalid cursors map to `INVALID_CURSOR`.

## Alternatives considered

Offset pagination — rejected for shifting pages under concurrent inserts.
