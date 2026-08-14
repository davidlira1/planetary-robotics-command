import { InvalidCursorError } from './errors';

export function encodeRobotCursor(id: string): string {
  return Buffer.from(JSON.stringify({ id }), 'utf8').toString('base64url');
}

export function decodeRobotCursor(cursor: string): string {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      id?: unknown;
    };
    if (typeof parsed.id !== 'string' || parsed.id.length === 0) {
      throw new Error('missing id');
    }
    return parsed.id;
  } catch {
    throw new InvalidCursorError('Invalid robot list cursor.');
  }
}

export function encodeTelemetryCursor(
  recordedAt: Date,
  telemetryId: string,
): string {
  return Buffer.from(
    JSON.stringify({
      recordedAt: recordedAt.toISOString(),
      telemetryId,
    }),
    'utf8',
  ).toString('base64url');
}

export function decodeTelemetryCursor(cursor: string): {
  recordedAt: Date;
  telemetryId: string;
} {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      recordedAt?: unknown;
      telemetryId?: unknown;
    };
    if (
      typeof parsed.recordedAt !== 'string' ||
      typeof parsed.telemetryId !== 'string' ||
      parsed.telemetryId.length === 0
    ) {
      throw new Error('invalid');
    }
    const recordedAt = new Date(parsed.recordedAt);
    if (Number.isNaN(recordedAt.getTime())) {
      throw new Error('invalid date');
    }
    return { recordedAt, telemetryId: parsed.telemetryId };
  } catch {
    throw new InvalidCursorError('Invalid telemetry cursor.');
  }
}
