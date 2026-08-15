import {
  HealthDimensionStatus,
  RobotHealthStatus,
  RobotOperationalStatus,
  RobotType,
} from '@prc/domain';
import { FleetReadRepository } from '../ports/fleet-read-repository';
import { FleetSnapshot } from '../read-models/fleet';
import { GetFleetSnapshot } from './get-fleet-snapshot';

describe('GetFleetSnapshot', () => {
  it('returns robots ordered by id with state and health', async () => {
    const snapshot: FleetSnapshot = {
      robots: [
        {
          id: 'D-04',
          displayName: 'D-04',
          type: RobotType.DRONE,
          model: 'AX-4',
          operationalStatus: RobotOperationalStatus.ACTIVE,
          currentState: {
            robotId: 'D-04',
            position: { x: 1, y: 2, z: 3 },
            batteryPercent: 80,
            temperatureCelsius: 40,
            signalStrengthDbm: -70,
            velocityMetersPerSecond: 1,
            headingDegrees: 10,
            recordedAt: new Date('2026-08-14T20:00:00.000Z'),
            receivedAt: new Date('2026-08-14T20:00:01.000Z'),
          },
          health: {
            robotId: 'D-04',
            status: RobotHealthStatus.HEALTHY,
            batteryStatus: HealthDimensionStatus.NORMAL,
            temperatureStatus: HealthDimensionStatus.NORMAL,
            signalStatus: HealthDimensionStatus.NORMAL,
            evaluatedFromTelemetryId: 'tel_1',
            evaluatedFromRecordedAt: new Date('2026-08-14T20:00:00.000Z'),
            updatedAt: new Date('2026-08-14T20:00:02.000Z'),
          },
        },
        {
          id: 'H-17',
          displayName: 'H-17',
          type: RobotType.HAULER,
          model: 'HX-9',
          operationalStatus: RobotOperationalStatus.IDLE,
          currentState: null,
          health: null,
        },
      ],
    };

    const fleet: FleetReadRepository = {
      async getSnapshot() {
        return snapshot;
      },
    };

    const result = await new GetFleetSnapshot(fleet).execute();
    expect(result.robots.map((r) => r.id)).toEqual(['D-04', 'H-17']);
    expect(result.robots[0]!.currentState?.batteryPercent).toBe(80);
    expect(result.robots[0]!.health?.status).toBe(RobotHealthStatus.HEALTHY);
    expect(result.robots[1]!.currentState).toBeNull();
    expect(result.robots[1]!.health).toBeNull();
  });
});
