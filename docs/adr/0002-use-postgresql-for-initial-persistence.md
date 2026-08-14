# ADR 0002: Use PostgreSQL for initial persistence

## Context

Layer 1 needs durable relational storage for robots, current state, and telemetry history.

## Decision

Use PostgreSQL via Docker Compose locally, accessed through Prisma adapters behind repository ports.

## Consequences

Strong constraints, transactions, and indexes. Replacing the database later requires a new adapter/migrations, not domain rewrites. MongoDB is not treated as a drop-in.

## Alternatives considered

SQL Server/MySQL now — deferred. Time-series DB for telemetry — deferred beyond Layer 1.
