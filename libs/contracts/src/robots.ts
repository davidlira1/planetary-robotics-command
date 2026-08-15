import { z } from 'zod';
import { RobotHealthSchema } from './health';

export const RobotTypeSchema = z.enum([
  'SCOUT',
  'DRONE',
  'HAULER',
  'WORKER',
  'MINER',
]);

export const RobotOperationalStatusSchema = z.enum([
  'OFFLINE',
  'IDLE',
  'ACTIVE',
  'CHARGING',
  'FAULTED',
]);

export const PositionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
});

export const CurrentStateSchema = z.object({
  position: PositionSchema,
  batteryPercent: z.number().finite(),
  temperatureCelsius: z.number().finite(),
  signalStrengthDbm: z.number().finite(),
  velocityMetersPerSecond: z.number().finite(),
  headingDegrees: z.number().finite(),
  recordedAt: z.string().datetime(),
  receivedAt: z.string().datetime(),
});

export const RobotSummarySchema = z.object({
  id: z.string(),
  displayName: z.string(),
  type: RobotTypeSchema,
  model: z.string(),
  operationalStatus: RobotOperationalStatusSchema,
  currentState: CurrentStateSchema.nullable(),
});

export const RobotDetailSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  type: RobotTypeSchema,
  model: z.string(),
  operationalStatus: RobotOperationalStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  currentState: CurrentStateSchema.nullable(),
  health: RobotHealthSchema.nullable(),
});

export const PageSchema = z.object({
  limit: z.number().int(),
  nextCursor: z.string().nullable(),
});

export const ListRobotsQuerySchema = z.object({
  type: RobotTypeSchema.optional(),
  status: RobotOperationalStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().min(1).optional(),
});

export const ListRobotsResponseSchema = z.object({
  items: z.array(RobotSummarySchema),
  page: PageSchema,
});

export type ListRobotsQuery = z.infer<typeof ListRobotsQuerySchema>;
export type ListRobotsResponse = z.infer<typeof ListRobotsResponseSchema>;
export type RobotDetail = z.infer<typeof RobotDetailSchema>;
