import { z } from 'zod';

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;

const positiveIntFromEnv = (fallback: number) =>
  z.preprocess(
    (v) => (v === undefined || v === '' ? fallback : Number(v)),
    z.number().int().positive(),
  );

export const RetentionEnvSchema = z.object({
  TELEMETRY_RETENTION_HOURS: positiveIntFromEnv(2),
  PUBLISHED_OUTBOX_RETENTION_HOURS: positiveIntFromEnv(2),
  PROCESSED_MESSAGE_RETENTION_HOURS: positiveIntFromEnv(24),
  RETENTION_INTERVAL_MINUTES: positiveIntFromEnv(10),
});

export type RetentionEnv = z.infer<typeof RetentionEnvSchema>;

export interface RetentionConfig {
  telemetryRetentionHours: number;
  publishedOutboxRetentionHours: number;
  processedMessageRetentionHours: number;
  retentionIntervalMinutes: number;
  telemetryRetentionMs: number;
  publishedOutboxRetentionMs: number;
  processedMessageRetentionMs: number;
  intervalMs: number;
}

export function loadRetentionConfig(
  env: NodeJS.ProcessEnv = process.env,
): RetentionConfig {
  const parsed = RetentionEnvSchema.parse(env);
  return {
    telemetryRetentionHours: parsed.TELEMETRY_RETENTION_HOURS,
    publishedOutboxRetentionHours: parsed.PUBLISHED_OUTBOX_RETENTION_HOURS,
    processedMessageRetentionHours: parsed.PROCESSED_MESSAGE_RETENTION_HOURS,
    retentionIntervalMinutes: parsed.RETENTION_INTERVAL_MINUTES,
    telemetryRetentionMs: parsed.TELEMETRY_RETENTION_HOURS * MS_PER_HOUR,
    publishedOutboxRetentionMs: parsed.PUBLISHED_OUTBOX_RETENTION_HOURS * MS_PER_HOUR,
    processedMessageRetentionMs: parsed.PROCESSED_MESSAGE_RETENTION_HOURS * MS_PER_HOUR,
    intervalMs: parsed.RETENTION_INTERVAL_MINUTES * MS_PER_MINUTE,
  };
}
