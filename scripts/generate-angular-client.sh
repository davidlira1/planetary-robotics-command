#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${ROOT}/libs/api-client-angular/generated"

rm -rf "${OUT}"
mkdir -p "${OUT}"

# Pin: OpenAPI Generator 7.24.0 (official image; no local JRE required).
docker run --rm \
  -v "${ROOT}:/local" \
  openapitools/openapi-generator-cli:v7.24.0 generate \
  -i /local/specs/openapi/openapi.v1.yaml \
  -g typescript-angular \
  -o /local/libs/api-client-angular/generated \
  --additional-properties=ngVersion=22.0.0,providedIn=none,supportsES6=true,fileNaming=kebab-case,serviceFileSuffix=.service,serviceSuffix=Service

rm -f "${OUT}/.gitignore" \
  "${OUT}/git_push.sh" \
  "${OUT}/README.md" \
  "${OUT}/package.json" \
  "${OUT}/tsconfig.json" \
  "${OUT}/tsconfig.esm.json" \
  "${OUT}/ng-package.json" \
  "${OUT}/.openapi-generator-ignore"

echo "Generated Angular client at ${OUT}"
