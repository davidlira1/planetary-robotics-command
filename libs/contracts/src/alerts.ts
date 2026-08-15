import { z } from 'zod';
import { PageSchema } from './robots';

export const AlertTypeSchema = z.enum([
  'LOW_BATTERY',
  'HIGH_TEMPERATURE',
  'SIGNAL_DEGRADED',
]);

export const AlertSeveritySchema = z.enum(['WARNING', 'CRITICAL']);

export const AlertStatusSchema = z.enum(['OPEN', 'ACKNOWLEDGED']);

export const AlertItemSchema = z.object({
  id: z.string(),
  robotId: z.string(),
  type: AlertTypeSchema,
  severity: AlertSeveritySchema,
  status: AlertStatusSchema,
  title: z.string(),
  message: z.string(),
  sourceTelemetryId: z.string(),
  sourceEventId: z.string(),
  createdAt: z.string().datetime(),
  acknowledgedAt: z.string().datetime().nullable(),
  acknowledgedBy: z.string().nullable(),
});

export const ListAlertsQuerySchema = z.object({
  robotId: z.string().min(1).optional(),
  severity: AlertSeveritySchema.optional(),
  status: AlertStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().min(1).optional(),
});

export const ListAlertsResponseSchema = z.object({
  items: z.array(AlertItemSchema),
  page: PageSchema,
});

export type AlertItem = z.infer<typeof AlertItemSchema>;
export type ListAlertsQuery = z.infer<typeof ListAlertsQuerySchema>;
export type ListAlertsResponse = z.infer<typeof ListAlertsResponseSchema>;
