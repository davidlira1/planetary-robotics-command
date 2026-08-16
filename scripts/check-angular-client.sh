#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CURRENT="${ROOT}/libs/api-client-angular/generated"
TMP="$(mktemp -d)"

cleanup() {
  rm -rf "${TMP}"
}
trap cleanup EXIT

# Generate into a host temp dir mounted at /out so we can diff without
# writing into the workspace tree.
docker run --rm \
  -v "${ROOT}:/local" \
  -v "${TMP}:/out" \
  openapitools/openapi-generator-cli:v7.24.0 generate \
  -i /local/specs/openapi/openapi.v1.yaml \
  -g typescript-angular \
  -o /out/generated \
  --additional-properties=ngVersion=22.0.0,providedIn=none,supportsES6=true,fileNaming=kebab-case,serviceFileSuffix=.service,serviceSuffix=Service

OUT="${TMP}/generated"

rm -f "${OUT}/.gitignore" \
  "${OUT}/git_push.sh" \
  "${OUT}/README.md" \
  "${OUT}/package.json" \
  "${OUT}/tsconfig.json" \
  "${OUT}/tsconfig.esm.json" \
  "${OUT}/ng-package.json" \
  "${OUT}/.openapi-generator-ignore"

if ! diff -rq "${CURRENT}" "${OUT}" >/dev/null; then
  echo "Angular OpenAPI client is out of date. Run: pnpm api:generate:angular"
  diff -rq "${CURRENT}" "${OUT}" || true
  exit 1
fi

echo "Angular OpenAPI client is up to date."
