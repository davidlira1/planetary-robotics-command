import { z } from 'zod';
import { RobotHealthSchema } from './health';
import {
  CurrentStateSchema,
  RobotOperationalStatusSchema,
  RobotTypeSchema,
} from './robots';

export const FleetRobotSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  type: RobotTypeSchema,
  model: z.string(),
  operationalStatus: RobotOperationalStatusSchema,
  currentState: CurrentStateSchema.nullable(),
  health: RobotHealthSchema.nullable(),
});

export const FleetSnapshotResponseSchema = z.object({
  robots: z.array(FleetRobotSchema),
});

export type FleetRobot = z.infer<typeof FleetRobotSchema>;
export type FleetSnapshotResponse = z.infer<typeof FleetSnapshotResponseSchema>;
