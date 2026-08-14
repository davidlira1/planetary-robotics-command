# ADR 0010: At-least-once delivery and idempotent consumers

## Context

Service Bus and the outbox crash window can deliver the same `eventId` more than once. Concurrent duplicate deliveries may race.

## Decision

Do **not** assume exactly-once. Health worker uses an inbox:

- Unique `(consumer, eventId)` on `ProcessedMessage` is the final authority.
- In one transaction: try-insert processed marker → `SELECT … FOR UPDATE` health row → chronology gate → update health → append alerts.
- Only the delivery that acquires the unique insert applies side effects.

## Consequences

Safe duplicates; possible republish after successful broker send if `markPublished` never ran.

## Alternatives considered

Exists-then-markProcessed — rejected (TOCTOU race).
