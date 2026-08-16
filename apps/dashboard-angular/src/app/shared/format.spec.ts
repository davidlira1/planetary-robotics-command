import type { FleetRobot } from '../core/models';
import { robotAccessibleName } from './format';

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

describe('robotAccessibleName', () => {
  it('includes id and model/type without health when none is available', () => {
    expect(robotAccessibleName(robot({ id: 'D-04' }))).toBe('D-04, AX-4 DRONE');
  });

  it('includes health status when available', () => {
    expect(
      robotAccessibleName(
        robot({
          id: 'D-04',
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
      ),
    ).toBe('D-04, AX-4 DRONE, health warning');
  });
});
