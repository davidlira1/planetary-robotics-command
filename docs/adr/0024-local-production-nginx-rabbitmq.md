# ADR 0024: Local production topology with Nginx and RabbitMQ

## Context

`pnpm docker:up` plus eight `dev:*` terminals is the developer loop (Service Bus emulator, Angular proxy on :4200). Inexpensive VM deployment needs one Compose file that serves the SPA, API, WebSocket, workers, simulator, Postgres, and a broker — without exposing the broker or database.

## Decision

- Keep the existing ASB emulator workflow for `pnpm dev:*`.
- Add a second Compose file (`infrastructure/docker/docker-compose.prod.yml`) used by `pnpm prod:init|up|down|reset`.
- Edge: Nginx on host port 80 only. `/` SPA, `/api/` API, `/health` → `/health/live` and `/health/ready`, `/realtime` WebSocket upgrade.
- Broker: `@prc/messaging-rabbitmq` behind `EventPublisher` and `TelemetryConsumer`. Durable fanout exchange `robot.telemetry.received`; independent queues `*.health` and `*.realtime`. Explicit DLX routing keys `health` / `realtime`. Persistent messages.
- Transient `abandon` uses per-consumer TTL retry queues (default 2000 ms) and header `x-prc-delivery-count`, max **10** (same idea as ASB `MaxDeliveryCount`). Permanent `deadLetter` nacks without requeue immediately.
- Postgres and RabbitMQ volumes (`prc_prod_*`) are separate from local-dev `prc_postgres_data`. `prod:down` keeps them; `prod:reset` deletes them.
- The same Compose topology is what a later Azure VM will run. This ADR does not provision Azure, DNS, or TLS.

## Consequences

`http://localhost` is the acceptance surface. Messaging workers select the adapter with `MESSAGE_BROKER_PROVIDER`. ASB remains the default for host `dev:*`.

## Alternatives considered

NATS JetStream — rejected (RabbitMQ is the chosen VM/local-prod broker). Caddy — rejected (Nginx is already familiar). Unlimited `nack(requeue=true)` — rejected (hot-loop; does not match ASB bounded redelivery). Publishing RabbitMQ or Postgres ports — rejected for the production-like topology.
