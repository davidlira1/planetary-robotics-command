import {
  RobotTelemetryReceivedEventV1Schema,
  type RobotStateUpdatedV1,
} from '@prc/contracts';
import type { Logger, SettlementAction } from '@prc/ports';
import { mapRobotStateUpdated } from './map-robot-state-updated';
import type { RealtimeBroadcaster } from './realtime-broadcaster';

export async function handleRealtimeTelemetry(
  body: unknown,
  broadcaster: RealtimeBroadcaster,
  logger: Logger,
): Promise<SettlementAction> {
  const parsed = RobotTelemetryReceivedEventV1Schema.safeParse(body);
  if (!parsed.success) {
    logger.error('Permanent realtime message failure', {
      operation: 'realtime-gateway',
      errorCode: 'PERMANENT',
    });
    return 'deadLetter';
  }
  const message: RobotStateUpdatedV1 = mapRobotStateUpdated(parsed.data);
  try {
    await broadcaster.publish(JSON.stringify(message));
    logger.info('Telemetry event broadcast', {
      operation: 'realtime-gateway',
      eventId: parsed.data.eventId,
      correlationId: parsed.data.correlationId,
      robotId: parsed.data.payload.robotId,
      clientCount: broadcaster.clientCount(),
    });
    return 'complete';
  } catch (err) {
    logger.error('Transient realtime broadcast failure', {
      operation: 'realtime-gateway',
      eventId: parsed.data.eventId,
      correlationId: parsed.data.correlationId,
      robotId: parsed.data.payload.robotId,
      errorCode: 'TRANSIENT',
      err: err instanceof Error ? err.message : String(err),
    });
    return 'abandon';
  }
}
