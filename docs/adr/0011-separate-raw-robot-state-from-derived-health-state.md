# ADR 0011: Separate raw robot state from derived health state

## Context

Raw telemetry facts and health interpretation must not be conflated with `RobotOperationalStatus`.

## Decision

Keep `RobotCurrentState` as latest telemetry facts. Persist `RobotHealthState` separately with dimension + overall statuses derived by `EvaluateRobotHealth`. Chronology uses `evaluatedFromRecordedAt` (strictly newer wins; equal keeps existing).

## Consequences

Clear separation of concerns; health can evolve without changing fleet raw-state APIs.

## Alternatives considered

Fold health into `RobotCurrentState` or overload `FAULTED` — rejected.
