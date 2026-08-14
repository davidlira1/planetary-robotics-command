# ADR 0001: Use hexagonal architecture

## Context

The platform must remain portable across NestJS/ASP.NET/FastAPI and PostgreSQL/other relational stores without rewriting business logic.

## Decision

Organize code as hexagonal / ports-and-adapters: domain and application depend only on ports; NestJS and Prisma are adapters.

## Consequences

Clear boundaries and testability. Slightly more packaging overhead than a single Nest module tree.

## Alternatives considered

Classic NestJS layered modules only — rejected for portability. Full DDD aggregates everywhere — rejected as ceremony without Layer 1 benefit.
