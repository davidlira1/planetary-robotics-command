# ADR 0012: Transition-based health alerting

## Context

Alerting on every sample below a threshold causes alert fatigue.

## Decision

Create dimension-specific alerts (`LOW_BATTERY`, `HIGH_TEMPERATURE`, `SIGNAL_DEGRADED`) only when a dimension **enters** WARNING or **escalates** to CRITICAL. Repeated samples in the same band create no new alerts. No recovery alerts in Layer 2.

## Consequences

Sparse, meaningful alerts; health state still updates every newer evaluation.

## Alternatives considered

Alert every sample — rejected. Overall-only `ROBOT_HEALTH_*` alerts — deferred (dimension alerts suffice for Layer 2 tests).
