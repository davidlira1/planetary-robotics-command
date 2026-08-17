export function recordedAtMs(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function isNewerRecordedAt(incoming: string, existing: string | undefined): boolean {
  const next = recordedAtMs(incoming);
  const prev = recordedAtMs(existing);
  if (next === null) {
    return false;
  }
  if (prev === null) {
    return true;
  }
  return next > prev;
}

export function newerCurrentState<T extends { recordedAt: string }>(
  rest: T | null | undefined,
  streamed: T | null | undefined,
): T | null {
  if (!rest) {
    return streamed ?? null;
  }
  if (!streamed) {
    return rest;
  }
  return isNewerRecordedAt(streamed.recordedAt, rest.recordedAt) ? streamed : rest;
}
