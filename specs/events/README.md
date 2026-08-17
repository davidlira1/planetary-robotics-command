# Event contracts

Language-neutral integration contracts for Planetary Robotics Command.

## Source of truth

JSON Schema files in this directory are the polyglot integration artifacts.

TypeScript Zod schemas under `@prc/contracts` are aligned to these schemas for runtime validation in the NestJS/TypeScript implementation.

## Versioning

- Breaking changes to an event type require a new `eventVersion` (e.g. v2).
- Do not mutate a published v1 schema incompatibly.
- Consumers must reject unsupported `eventVersion` values as permanent failures.

## Envelope (v1)

See `event-envelope.v1.schema.json`.

## Events

| eventType | eventVersion | Payload schema |
|---|---|---|
| `robot.telemetry.received` | 1 | `robot-telemetry-received.v1.schema.json` |

Browser WebSocket messages are a separate public contract under [`specs/realtime`](../realtime/README.md).

## Portability

Producers and consumers in NestJS, .NET, or Python should implement these JSON contracts without depending on TypeScript types as the sole source of truth.
