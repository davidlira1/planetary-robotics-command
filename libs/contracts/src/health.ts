import { z } from 'zod';

export const RobotHealthStatusSchema = z.enum([
  'HEALTHY',
  'WARNING',
  'CRITICAL',
]);

export const HealthDimensionStatusSchema = z.enum([
  'NORMAL',
  'WARNING',
  'CRITICAL',
]);

export const RobotHealthSchema = z.object({
  status: RobotHealthStatusSchema,
  batteryStatus: HealthDimensionStatusSchema,
  temperatureStatus: HealthDimensionStatusSchema,
  signalStatus: HealthDimensionStatusSchema,
  evaluatedFromTelemetryId: z.string().min(1),
  evaluatedFromRecordedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type RobotHealth = z.infer<typeof RobotHealthSchema>;
