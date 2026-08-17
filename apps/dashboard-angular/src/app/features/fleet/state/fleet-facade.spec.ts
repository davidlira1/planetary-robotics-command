import { firstValueFrom, of, throwError } from 'rxjs';
import type { RobotStateUpdatedV1 } from '@prc/contracts';
import type { FleetRobot, FleetRobotCurrentState } from '../../../core/models';
import type { FleetDataSource } from '../data-access/fleet-data-source';
import { FleetFacade } from './fleet-facade';

function robot(id: string, currentState: FleetRobotCurrentState | null = null): FleetRobot {
  return {
    id,
    displayName: id,
    type: 'DRONE',
    model: 'AX-4',
    operationalStatus: 'ACTIVE',
    currentState,
    health: id === 'D-04' ? { status: 'HEALTHY', batteryStatus: 'NORMAL', temperatureStatus: 'NORMAL', signalStatus: 'NORMAL', evaluatedFromTelemetryId: 'tel', evaluatedFromRecordedAt: '2026-08-13T20:00:00.000Z', updatedAt: '2026-08-13T20:00:00.000Z' } : null,
  };
}

function state(recordedAt: string, x = 1): FleetRobotCurrentState {
  return {
    position: { x, y: 2, z: 3 },
    batteryPercent: 80,
    temperatureCelsius: 40,
    signalStrengthDbm: -70,
    velocityMetersPerSecond: 1,
    headingDegrees: 10,
    recordedAt,
    receivedAt: recordedAt,
  };
}

function update(id: string, recordedAt: string, x = 1): RobotStateUpdatedV1 {
  return {
    type: 'robot.state.updated',
    version: 1,
    eventId: `evt_${recordedAt}`,
    occurredAt: recordedAt,
    robot: { id, currentState: state(recordedAt, x) },
  };
}

function source(impl: Partial<FleetDataSource>): FleetDataSource {
  return {
    getFleet: impl.getFleet ?? (() => of({ robots: [] })),
  };
}

function expectReadonlySignal(value: object): void {
  expect(value).not.toHaveProperty('set');
  expect(value).not.toHaveProperty('update');
}

describe('FleetFacade', () => {
  it('exposes read-only signals and mutates only through intents', async () => {
    const facade = new FleetFacade(source({ getFleet: () => of({ robots: [robot('D-04')] }) }));
    expectReadonlySignal(facade.robots);
    expectReadonlySignal(facade.selectedRobotId);
    expectReadonlySignal(facade.loading);
    expectReadonlySignal(facade.error);
    expectReadonlySignal(facade.loadedAt);

    expect(facade.robots()).toEqual([]);
    expect(facade.selectedRobotId()).toBeNull();

    await firstValueFrom(facade.loadFleet());
    expect(facade.robots()).toEqual([robot('D-04')]);

    facade.selectRobot('D-04');
    expect(facade.selectedRobotId()).toBe('D-04');
    facade.clearSelection();
    expect(facade.selectedRobotId()).toBeNull();
  });

  it('loads robots and records loadedAt on success', async () => {
    const facade = new FleetFacade(source({ getFleet: () => of({ robots: [robot('D-04')] }) }));
    await firstValueFrom(facade.loadFleet());
    expect(facade.robots()).toEqual([robot('D-04')]);
    expect(facade.loading()).toBe(false);
    expect(facade.error()).toBeNull();
    expect(facade.loadedAt()).toBeInstanceOf(Date);
  });

  it('records an error without inventing robots', async () => {
    const facade = new FleetFacade(
      source({ getFleet: () => throwError(() => new Error('API down')) }),
    );
    await firstValueFrom(facade.loadFleet());
    expect(facade.robots()).toEqual([]);
    expect(facade.error()).toBe('API down');
    expect(facade.loadedAt()).toBeNull();
  });

  it('selects a present robot and derives selectedRobot', async () => {
    const facade = new FleetFacade(
      source({ getFleet: () => of({ robots: [robot('D-04'), robot('W-08')] }) }),
    );
    await firstValueFrom(facade.loadFleet());
    facade.selectRobot('W-08');
    expect(facade.selectedRobotId()).toBe('W-08');
    expect(facade.selectedRobot()?.id).toBe('W-08');
  });

  it('ignores unknown ids', async () => {
    const facade = new FleetFacade(source({ getFleet: () => of({ robots: [robot('D-04')] }) }));
    await firstValueFrom(facade.loadFleet());
    facade.selectRobot('NOPE');
    expect(facade.selectedRobotId()).toBeNull();
    expect(facade.selectedRobot()).toBeNull();
  });

  it('clears selection', async () => {
    const facade = new FleetFacade(source({ getFleet: () => of({ robots: [robot('D-04')] }) }));
    await firstValueFrom(facade.loadFleet());
    facade.selectRobot('D-04');
    facade.clearSelection();
    expect(facade.selectedRobotId()).toBeNull();
  });

  it('patches only currentState and preserves health metadata', async () => {
    const facade = new FleetFacade(source({ getFleet: () => of({ robots: [robot('D-04')] }) }));
    await firstValueFrom(facade.loadFleet());
    facade.applyRobotStateUpdated(update('D-04', '2026-08-13T20:00:05.000Z', 9));
    const next = facade.robots()[0];
    expect(next?.currentState?.position.x).toBe(9);
    expect(next?.health?.status).toBe('HEALTHY');
    expect(next?.displayName).toBe('D-04');
  });

  it('ignores older or equal recordedAt updates', async () => {
    const facade = new FleetFacade(source({ getFleet: () => of({ robots: [robot('D-04')] }) }));
    await firstValueFrom(facade.loadFleet());
    facade.applyRobotStateUpdated(update('D-04', '2026-08-13T20:00:05.000Z', 5));
    facade.applyRobotStateUpdated(update('D-04', '2026-08-13T20:00:05.000Z', 6));
    facade.applyRobotStateUpdated(update('D-04', '2026-08-13T20:00:04.000Z', 4));
    expect(facade.robots()[0]?.currentState?.position.x).toBe(5);
  });

  it('positions a robot that had null currentState', async () => {
    const facade = new FleetFacade(source({ getFleet: () => of({ robots: [robot('H-17')] }) }));
    await firstValueFrom(facade.loadFleet());
    expect(facade.robots()[0]?.currentState).toBeNull();
    facade.applyRobotStateUpdated(update('H-17', '2026-08-13T20:00:05.000Z', 12));
    expect(facade.robots()[0]?.currentState?.position.x).toBe(12);
  });

  it('does not invent a robot for an unknown id, then drops that state after snapshot', async () => {
    const facade = new FleetFacade(source({ getFleet: () => of({ robots: [robot('D-04')] }) }));
    facade.applyRobotStateUpdated(update('NOPE', '2026-08-13T20:00:05.000Z', 99));
    expect(facade.robots()).toEqual([]);
    await firstValueFrom(facade.loadFleet());
    expect(facade.robots().map((item) => item.id)).toEqual(['D-04']);
    expect(facade.robots().some((item) => item.id === 'NOPE')).toBe(false);
  });

  it('does not let an older REST snapshot overwrite newer stream state', async () => {
    const rest = robot('D-04', state('2026-08-13T20:00:04.000Z', 4));
    const facade = new FleetFacade(source({ getFleet: () => of({ robots: [rest] }) }));
    facade.applyRobotStateUpdated(update('D-04', '2026-08-13T20:00:05.000Z', 5));
    await firstValueFrom(facade.loadFleet());
    expect(facade.robots()[0]?.currentState?.position.x).toBe(5);
    expect(facade.robots()[0]?.health?.status).toBe('HEALTHY');
  });

  it('does not prune retained stream state when a snapshot load fails', async () => {
    const facade = new FleetFacade(
      source({
        getFleet: jest
          .fn()
          .mockReturnValueOnce(throwError(() => new Error('API down')))
          .mockReturnValueOnce(of({ robots: [robot('D-04', state('2026-08-13T20:00:04.000Z', 4))] })),
      }),
    );
    facade.applyRobotStateUpdated(update('D-04', '2026-08-13T20:00:05.000Z', 5));
    await firstValueFrom(facade.loadFleet());
    expect(facade.error()).toBe('API down');
    await firstValueFrom(facade.loadFleet());
    expect(facade.robots()[0]?.currentState?.position.x).toBe(5);
  });
});
