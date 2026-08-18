# ADR 0009: Use Azure Service Bus topic for telemetry events

## Context

Layer 2 needs backend-to-backend messaging with room for multiple consumers.

## Decision

Publish `robot.telemetry.received` to an Azure Service Bus **topic** with an initial `health` subscription. Local development uses the official Service Bus emulator. Application code depends on `EventPublisher` / consumer adapters, not the Azure SDK.

## Consequences

Fan-out ready for analytics/missions later; Azure-specific code stays under `@prc/messaging-asb`. VM/local-production uses `@prc/messaging-rabbitmq` behind the same `EventPublisher` / `TelemetryConsumer` ports (see ADR 0024); the Service Bus emulator remains the local `dev:*` adapter.

## Alternatives considered

Queue-only — rejected (single consumer). Kafka now — deferred.
