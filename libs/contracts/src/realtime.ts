import { z } from 'zod';
import { CurrentStateSchema } from './robots';

export const ROBOT_STATE_UPDATED_TYPE = 'robot.state.updated' as const;
export const REALTIME_READY_TYPE = 'realtime.ready' as const;

export const RealtimeReadyV1Schema = z.object({
  type: z.literal(REALTIME_READY_TYPE),
  version: z.literal(1),
});

export const RobotStateUpdatedV1Schema = z.object({
  type: z.literal(ROBOT_STATE_UPDATED_TYPE),
  version: z.literal(1),
  eventId: z.string().min(1),
  occurredAt: z.string().datetime(),
  robot: z.object({
    id: z.string().min(1),
    currentState: CurrentStateSchema,
  }),
});

export type RealtimeReadyV1 = z.infer<typeof RealtimeReadyV1Schema>;
export type RobotStateUpdatedV1 = z.infer<typeof RobotStateUpdatedV1Schema>;
