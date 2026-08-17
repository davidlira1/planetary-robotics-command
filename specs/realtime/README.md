# Browser realtime contracts

Language-neutral **public** WebSocket messages for the command dashboard.

These are not Service Bus integration events. Internal `robot.telemetry.received` stays under [`specs/events`](../events/README.md). The realtime gateway maps that envelope to these browser messages.

## Source of truth

JSON Schema files in this directory are the polyglot artifacts. TypeScript Zod schemas under `@prc/contracts` are aligned for runtime validation on the gateway and in the Angular adapter.

## Versioning

- Breaking changes require a new `version` (e.g. v2).
- Clients must ignore unknown `type` values.
- Do not mutate a published v1 schema incompatibly.

## Messages

| type | version | Schema |
|---|---|---|
| `realtime.ready` | 1 | `realtime-ready.v1.schema.json` |
| `robot.state.updated` | 1 | `robot-state-updated.v1.schema.json` |

Envelope fields shared by data messages: `type`, `version`, `eventId`, `occurredAt` (`realtime-envelope.v1.schema.json`).
