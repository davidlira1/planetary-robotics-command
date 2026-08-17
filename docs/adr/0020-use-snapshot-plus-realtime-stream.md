# ADR 0020: Snapshot plus realtime stream for dashboard state

## Context

Layer 5 loads `GET /api/v1/fleet` once. Simulator telemetry keeps moving. Polling would be simple but would either lag or hammer the read API, and it would hide the existing event pipeline.

## Decision

Keep REST as the authoritative **snapshot** ("what is true when I connect / reconnect"). Add a WebSocket **stream** of `robot.state.updated` for changes after connect. The stream is produced by a new Service Bus `realtime` subscription and `apps/realtime-gateway`; it does not replace `/fleet` and does not publish from `POST /telemetry`.

Polling is rejected: the outbox already guarantees telemetry events, and the dashboard already interpolates target positions.

## Consequences

The facade must merge by `currentState.recordedAt` so neither a slow snapshot nor a duplicate/out-of-order socket message can regress state. Reconnect must fetch `/fleet` again (ADR 0022). Alerts stay snapshot-only in this layer.

## Alternatives considered

HTTP polling — rejected (load, lag, ignores the event pipeline). Browser event replay — deferred. Pushing the internal Service Bus envelope to the browser — rejected (ADR 0021).
