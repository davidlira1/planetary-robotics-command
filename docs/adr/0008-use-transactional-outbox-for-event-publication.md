# ADR 0008: Use transactional outbox for event publication

## Context

The API cannot include Azure Service Bus I/O inside the PostgreSQL transaction that persists telemetry.

## Decision

Persist an `OutboxMessage` in the same transaction as telemetry + current-state. A separate `outbox-publisher` process claims rows and publishes to the broker.

**Claim flow (short transactions only):**

1. `BEGIN` → `FOR UPDATE SKIP LOCKED` claim + set `claimedUntil` → `COMMIT`
2. Publish to Service Bus (outside any DB transaction)
3. Separate short txn: `markPublished` or `recordPublishFailure`

**At-least-once crash window:** if publish succeeds and the process dies before `markPublished`, the row is claimed again later and republished with the same `eventId`. Consumers must be idempotent.

## Consequences

Durable eventual publication; extra table + publisher process; eventual consistency between DB and broker.

## Alternatives considered

- Publish inside API request after commit (dual-write race) — rejected.
- Hold DB transaction open during broker I/O — rejected (locks, timeouts).
