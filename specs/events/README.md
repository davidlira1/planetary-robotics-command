# Future event contracts

Do not implement messaging in Layer 1.

Language-independent envelope convention:

```json
{
  "eventId": "evt_...",
  "eventType": "robot.telemetry.received",
  "eventVersion": 1,
  "occurredAt": "2026-08-13T20:00:00.000Z",
  "correlationId": "req_...",
  "causationId": "req_...",
  "payload": {}
}
```

Intended application port (future):

```ts
interface EventPublisher {
  publish(event: DomainEvent): Promise<void>;
}
```

Adapters later may include Azure Service Bus, Kafka, or RabbitMQ. Domain/application code must never instantiate cloud SDKs directly.

JSON Schema artifacts for events should eventually live under `specs/events/`.
