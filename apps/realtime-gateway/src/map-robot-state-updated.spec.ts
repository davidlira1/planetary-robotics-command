import { mapRobotStateUpdated } from './map-robot-state-updated';
import type { RobotTelemetryReceivedEventV1 } from '@prc/contracts';

function event(): RobotTelemetryReceivedEventV1 {
  return {
    eventId: 'evt_1',
    eventType: 'robot.telemetry.received',
    eventVersion: 1,
    occurredAt: '2026-08-13T20:00:03.100Z',
    correlationId: 'req_1',
    causationId: 'tel_1',
    payload: {
      robotId: 'D-04',
      telemetryId: 'tel_1',
      sourceTelemetryId: 'src_1',
      telemetrySchemaVersion: 1,
      recordedAt: '2026-08-13T20:00:03.000Z',
      receivedAt: '2026-08-13T20:00:03.100Z',
      position: { x: 140.2, y: 11.8, z: 72.4 },
      batteryPercent: 80,
      temperatureCelsius: 40,
      signalStrengthDbm: -70,
      velocityMetersPerSecond: 1,
      headingDegrees: 10,
    },
  };
}

describe('mapRobotStateUpdated', () => {
  it('maps internal telemetry into the public browser contract', () => {
    const message = mapRobotStateUpdated(event());
    expect(message).toEqual({
      type: 'robot.state.updated',
      version: 1,
      eventId: 'evt_1',
      occurredAt: '2026-08-13T20:00:03.100Z',
      robot: {
        id: 'D-04',
        currentState: {
          position: { x: 140.2, y: 11.8, z: 72.4 },
          batteryPercent: 80,
          temperatureCelsius: 40,
          signalStrengthDbm: -70,
          velocityMetersPerSecond: 1,
          headingDegrees: 10,
          recordedAt: '2026-08-13T20:00:03.000Z',
          receivedAt: '2026-08-13T20:00:03.100Z',
        },
      },
    });
  });
});
