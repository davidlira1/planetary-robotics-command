import { parseRobotStateUpdated } from './parse-robot-state-updated';

const valid = {
  type: 'robot.state.updated',
  version: 1,
  eventId: 'evt_1',
  occurredAt: '2026-08-13T20:00:03.100Z',
  robot: {
    id: 'D-04',
    currentState: {
      position: { x: 1, y: 2, z: 3 },
      batteryPercent: 80,
      temperatureCelsius: 40,
      signalStrengthDbm: -70,
      velocityMetersPerSecond: 1,
      headingDegrees: 10,
      recordedAt: '2026-08-13T20:00:03.000Z',
      receivedAt: '2026-08-13T20:00:03.100Z',
    },
  },
};

describe('parseRobotStateUpdated', () => {
  it('parses a valid JSON string', () => {
    expect(parseRobotStateUpdated(JSON.stringify(valid))?.robot.id).toBe('D-04');
  });

  it('rejects malformed payloads', () => {
    expect(parseRobotStateUpdated('{')).toBeNull();
    expect(parseRobotStateUpdated({ type: 'nope' })).toBeNull();
    expect(parseRobotStateUpdated({ type: 'realtime.ready', version: 1 })).toBeNull();
  });
});
