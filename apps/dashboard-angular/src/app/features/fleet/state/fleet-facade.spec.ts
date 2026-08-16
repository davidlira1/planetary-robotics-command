import { firstValueFrom, of, throwError } from 'rxjs';
import type { FleetRobot } from '../../../core/models';
import type { FleetDataSource } from '../data-access/fleet-data-source';
import { FleetFacade } from './fleet-facade';

function robot(id: string): FleetRobot {
  return {
    id,
    displayName: id,
    type: 'DRONE',
    model: 'AX-4',
    operationalStatus: 'ACTIVE',
    currentState: null,
    health: null,
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
});
