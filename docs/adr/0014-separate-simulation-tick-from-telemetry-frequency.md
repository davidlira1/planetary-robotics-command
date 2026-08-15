# ADR 0014: Separate simulation tick from telemetry frequency

## Context

Smooth continuous motion needs frequent updates; posting telemetry on every physics step would flood the API and obscure operational realism.

## Decision

- `SIMULATION_TICK_MS` schedules physics steps.
- Each step uses **actual elapsed monotonic time** (`deltaTime`), clamped to a max step, not an assumed fixed interval.
- `TELEMETRY_INTERVAL_MS` independently creates immutable `TelemetrySample` snapshots and sends them via `TelemetryProducer`.

## Consequences

Believable motion with bounded network load. Unit tests drive physics with explicit `deltaTime` sequences (no real timers). Retries reuse the same snapshot while simulated state continues to evolve.

## Alternatives considered

One telemetry message per tick — rejected (noisy and costly). Assumed fixed `dt = tickMs` — rejected (teleports after stalls / debugger pauses).
