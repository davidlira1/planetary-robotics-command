# Planetary Robotics Command

Enterprise-oriented planetary robotics command platform. **Layer 1** delivers the NestJS API, hexagonal domain/application boundaries, Prisma/PostgreSQL persistence, telemetry ingestion, and fleet/telemetry read APIs.

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/) 9 (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)
- Docker

## Quick start

```bash
pnpm setup
pnpm dev
```

Or step-by-step:

```bash
cp .env.example .env
pnpm install
pnpm docker:up
pnpm --filter @prc/persistence-prisma prisma:generate
pnpm migrate:deploy
pnpm seed
pnpm build
pnpm openapi:export
pnpm dev
```

- API: http://localhost:3000
- Swagger: http://localhost:3000/docs
- OpenAPI artifact: `specs/openapi/openapi.v1.yaml`
- Health: `GET /health/live`, `GET /health/ready`

## Tests

```bash
pnpm test:unit
pnpm test:integration
```

Integration/e2e tests require Postgres (`DATABASE_URL` in `.env`) and migrations applied.

## OpenAPI

Contracts live in `@prc/contracts` (Zod). Generate and drift-check:

```bash
pnpm openapi:export
pnpm openapi:check
```

## Architecture

See [docs/architecture.md](docs/architecture.md) and [docs/adr](docs/adr).

## Layer 1 scope

Included: robots, current state, historical telemetry, Docker Postgres, structured errors/request IDs, docs, tests.

Not included: Service Bus, simulator, Angular, Three.js, auth, missions, commands, alerts, AI, WebSockets.
