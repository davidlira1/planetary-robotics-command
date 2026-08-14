# ADR 0006: Atomic current-state update-if-newer

## Context

Concurrent telemetry for one robot can race if Node code reads, compares, and writes current state.

## Decision

Expose `updateIfNewer` on the current-state port. Implement with PostgreSQL `INSERT ... ON CONFLICT DO UPDATE ... WHERE EXCLUDED.recordedAt > stored.recordedAt`. Equal timestamps keep existing state; `recordedAt` is the sole authority.

## Consequences

Race-safe under concurrency. Adapter uses raw SQL for the conditional upsert.

## Alternatives considered

Application-level read-compare-write — rejected. `SELECT FOR UPDATE` then update — heavier and still easy to get wrong.
