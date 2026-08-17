import type {
  RobotStateUpdatedV1,
  RobotTelemetryReceivedEventV1,
} from '@prc/contracts';

export function mapRobotStateUpdated(
  event: RobotTelemetryReceivedEventV1,
): RobotStateUpdatedV1 {
  const payload = event.payload;
  return {
    type: 'robot.state.updated',
    version: 1,
    eventId: event.eventId,
    occurredAt: event.occurredAt,
    robot: {
      id: payload.robotId,
      currentState: {
        position: payload.position,
        batteryPercent: payload.batteryPercent,
        temperatureCelsius: payload.temperatureCelsius,
        signalStrengthDbm: payload.signalStrengthDbm,
        velocityMetersPerSecond: payload.velocityMetersPerSecond,
        headingDegrees: payload.headingDegrees,
        recordedAt: payload.recordedAt,
        receivedAt: payload.receivedAt,
      },
    },
  };
}
