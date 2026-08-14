# ADR 0004: Contract-first API versioning

## Context

Future Angular clients and alternate backends (.NET, Python) need a stable HTTP contract.

## Decision

Version business APIs under `/api/v1`. Use Zod schemas in `libs/contracts` as the executable source of truth; generate `specs/openapi/openapi.v1.yaml` from them; drift-check in CI via `openapi:check`.

## Consequences

Runtime validation and docs stay aligned. YAML is not hand-edited as an independent source.

## Alternatives considered

Hand-written OpenAPI as sole source — rejected for TypeScript Layer 1 drift risk. Nest DTO classes as sole source — rejected (Nest-coupled).
