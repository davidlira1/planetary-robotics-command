# ADR 0015: Dedicated fleet read model for dashboard

## Context

The Angular + Three.js dashboard needs all robots with current position and health in one request. Calling `GET /robots` then N× `GET /robots/:id` creates an N+1 frontend pattern.

## Decision

Expose `GET /api/v1/fleet` backed by `GetFleetSnapshot` and an application-owned `FleetReadRepository` returning `FleetSnapshot` / `FleetRobot` read models (Robot + current state + health). Persistence loads via a bounded Prisma relation include, not a per-robot query loop.

## Consequences

Clean dashboard bootstrap; clear separation of HTTP DTOs vs application read models vs domain. List/filter fleet overview (`GET /robots`) remains for lighter pagination use cases.

## Alternatives considered

N+1 detail fetches — rejected. Embedding alerts/telemetry history in `/fleet` — rejected (separate endpoints).
