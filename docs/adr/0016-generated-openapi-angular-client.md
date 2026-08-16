# ADR 0016: Generated OpenAPI Angular client

## Context

The dashboard must call the Layer 4 REST contract without hand-written DTOs or ad-hoc HTTP services. Feature components must not import generated API service classes.

## Decision

- Dashboard app is **Angular 22.1.2** (standalone, signals, zoneless) with TypeScript **6.0**.
- Generate `@prc/api-client-angular` from `specs/openapi/openapi.v1.yaml` with OpenAPI Generator **7.24.0** (`typescript-angular`, `ngVersion=22.0.0`, `providedIn=none`).
- Pin the CLI wrapper at `@openapitools/openapi-generator-cli@2.40.1`. Generation runs via the official Docker image `openapitools/openapi-generator-cli:v7.24.0` so a local JRE is not required.
- Output lives in `libs/api-client-angular/generated/` and is **DO NOT HAND EDIT**.
- Root scripts: `pnpm api:generate:angular`, `pnpm api:check:angular`.
- Only HTTP adapters import `DefaultService`. `BASE_PATH` is empty so the Angular dev proxy forwards `/api` and `/health` to `localhost:3000`.

## Consequences

Reproducible client, no CORS change on Nest, and a drift check that fails CI/local when the YAML and generated tree diverge.

## Alternatives considered

Hand-written HttpClient services — rejected (duplicates the contract). Enabling Nest CORS for Layer 5 — rejected (proxy is sufficient).
