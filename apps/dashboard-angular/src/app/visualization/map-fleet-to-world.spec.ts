import type { FleetRobot } from '../core/models';
import { mapFleetToWorldRobots } from './map-fleet-to-world';

function robot(partial: Partial<FleetRobot> & Pick<FleetRobot, 'id'>): FleetRobot {
  return {
    displayName: partial.id,
    type: 'DRONE',
    model: 'AX-4',
    operationalStatus: 'ACTIVE',
    currentState: null,
    health: null,
    ...partial,
  };
}

describe('mapFleetToWorldRobots', () => {
  it('omits robots without currentState', () => {
    const mapped = mapFleetToWorldRobots([
      robot({ id: 'D-04' }),
      robot({
        id: 'W-08',
        currentState: {
          position: { x: 1, y: 2, z: 3 },
          batteryPercent: 80,
          temperatureCelsius: 20,
          signalStrengthDbm: -60,
          velocityMetersPerSecond: 1,
          headingDegrees: 90,
          recordedAt: '2026-08-15T00:00:00.000Z',
          receivedAt: '2026-08-15T00:00:01.000Z',
        },
        health: {
          status: 'WARNING',
          batteryStatus: 'WARNING',
          temperatureStatus: 'NORMAL',
          signalStatus: 'NORMAL',
          evaluatedFromTelemetryId: 't1',
          evaluatedFromRecordedAt: '2026-08-15T00:00:00.000Z',
          updatedAt: '2026-08-15T00:00:01.000Z',
        },
      }),
    ]);
    expect(mapped).toEqual([
      {
        id: 'W-08',
        type: 'DRONE',
        position: { x: 1, y: 2, z: 3 },
        recordedAt: '2026-08-15T00:00:00.000Z',
        headingDegrees: 90,
        velocityMetersPerSecond: 1,
        healthStatus: 'WARNING',
      },
    ]);
  });

  it('maps unknown robot types to UNKNOWN instead of SCOUT', () => {
    const mapped = mapFleetToWorldRobots([
      robot({
        id: 'X-01',
        type: 'PROBE' as FleetRobot['type'],
        currentState: {
          position: { x: 0, y: 0, z: 0 },
          batteryPercent: 80,
          temperatureCelsius: 20,
          signalStrengthDbm: -60,
          velocityMetersPerSecond: 1,
          headingDegrees: 0,
          recordedAt: '2026-08-15T00:00:00.000Z',
          receivedAt: '2026-08-15T00:00:01.000Z',
        },
      }),
    ]);
    expect(mapped[0]?.type).toBe('UNKNOWN');
  });
});
