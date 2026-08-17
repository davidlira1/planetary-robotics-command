# ADR 0021: Isolate browser realtime transport behind an adapter

## Context

The dashboard needs a live socket without coupling `FleetFacade` or UI components to WebSocket APIs, Socket.IO, or Nest gateway types.

## Decision

- Public browser contract: `robot.state.updated` v1 in `specs/realtime` / `@prc/contracts` (not the internal `robot.telemetry.received` envelope).
- Gateway: plain Node composition root (`apps/realtime-gateway`) using the `ws` library, matching health-worker / outbox-publisher.
- Browser: `FleetRealtimeDataSource` exposes RxJS `connectionState$`, `messages$`, and `reconnected$`. `WebSocketFleetRealtimeDataSource` owns the native `WebSocket`.
- `RealtimeFacade` is provided on `CommandDashboardShellComponent` (not `providedIn: 'root'`) and converts connection state to a Signal. `ngOnDestroy` disconnects the socket.

## Consequences

Feature code never imports `WebSocket`. Reconnect/backoff stay in the adapter. Dev uses the Angular proxy (`/realtime` → `:3001`) so the API does not enable CORS.

## Alternatives considered

Socket.IO — rejected (extra protocol and coupling). Nest `@WebSocketGateway` in the worker — rejected (workers are not Nest apps). Putting Signals on the transport adapter — rejected so RxJS stays the async boundary.
