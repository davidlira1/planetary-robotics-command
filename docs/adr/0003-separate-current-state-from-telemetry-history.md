# ADR 0003: Separate current state from telemetry history

## Context

Fleet UIs need “latest state” without scanning all historical telemetry.

## Decision

Persist immutable `RobotTelemetry` history and a separate `RobotCurrentState` (one row per robot) updated only when incoming `recordedAt` is strictly newer.

## Consequences

Efficient fleet queries; out-of-order ingestion remains correct; dual writes require a transaction.

## Alternatives considered

Derive latest via `MAX(recordedAt)` queries — rejected for Layer 1 fleet performance.
