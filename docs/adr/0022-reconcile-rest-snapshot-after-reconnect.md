# ADR 0022: Reconcile REST snapshot after realtime reconnect

## Context

Service Bus is at-least-once. WebSockets drop. A client that reconnects has missed stream events and cannot assume the socket restores correctness.

## Decision

After a successful reconnect (not the first connect), the dashboard loads `GET /api/v1/fleet` again and merges by `recordedAt`. Newer stream state already held in the facade wins; older snapshot fields do not regress. Layer 6 does not replay missed socket events to the browser.

Unknown `robotId` stream states may be retained until that snapshot; ids still absent after a **successful** snapshot are dropped.

## Consequences

REST remains the reconciliation path. The live link is low-latency change, not a log. Failed snapshot loads do not prune retained stream state.

## Alternatives considered

Permanent in-browser event replay — rejected for Layer 6. Trusting stream-only after reconnect — rejected (lost updates).
