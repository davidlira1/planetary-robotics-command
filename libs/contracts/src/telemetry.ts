import { z } from 'zod';
import { PageSchema, PositionSchema } from './robots';

/** Layer 1 supported schema version. */
export const SUPPORTED_TELEMETRY_SCHEMA_VERSION = 1;

export const IngestTelemetryRequestSchema = z.object({
  sourceTelemetryId: z.string().min(1),
  robotId: z.string().min(1),
  schemaVersion: z
    .number()
    .int()
    .refine((v) => v === SUPPORTED_TELEMETRY_SCHEMA_VERSION, {
      message: `Unsupported schemaVersion. Layer 1 supports ${SUPPORTED_TELEMETRY_SCHEMA_VERSION} only.`,
    }),
  recordedAt: z.string().datetime(),
  position: PositionSchema,
  batteryPercent: z.number().finite().min(0).max(100),
  temperatureCelsius: z.number().finite(),
  signalStrengthDbm: z.number().finite(),
  velocityMetersPerSecond: z.number().finite().min(0),
  headingDegrees: z.number().finite().min(0).lt(360),
});

export const IngestTelemetryResponseSchema = z.object({
  telemetryId: z.string(),
  robotId: z.string(),
  recordedAt: z.string().datetime(),
  receivedAt: z.string().datetime(),
  status: z.literal('ACCEPTED'),
});

export const TelemetryHistoryItemSchema = z.object({
  telemetryId: z.string(),
  sourceTelemetryId: z.string(),
  schemaVersion: z.number().int(),
  position: PositionSchema,
  batteryPercent: z.number(),
  temperatureCelsius: z.number(),
  signalStrengthDbm: z.number(),
  velocityMetersPerSecond: z.number(),
  headingDegrees: z.number(),
  recordedAt: z.string().datetime(),
  receivedAt: z.string().datetime(),
});

export const ListTelemetryQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  cursor: z.string().min(1).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const ListTelemetryResponseSchema = z.object({
  robotId: z.string(),
  items: z.array(TelemetryHistoryItemSchema),
  page: PageSchema,
});

export type IngestTelemetryRequest = z.infer<typeof IngestTelemetryRequestSchema>;
export type IngestTelemetryResponse = z.infer<typeof IngestTelemetryResponseSchema>;
export type ListTelemetryQuery = z.infer<typeof ListTelemetryQuerySchema>;
export type ListTelemetryResponse = z.infer<typeof ListTelemetryResponseSchema>;
