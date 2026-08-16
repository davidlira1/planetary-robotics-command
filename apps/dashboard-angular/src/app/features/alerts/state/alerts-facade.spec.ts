import { firstValueFrom, of, throwError } from 'rxjs';
import type { FleetAlert } from '../../../core/models';
import type { AlertsDataSource } from '../data-access/alerts-data-source';
import { AlertsFacade } from './alerts-facade';

const sample: FleetAlert = {
  id: 'a1',
  robotId: 'D-04',
  type: 'LOW_BATTERY',
  severity: 'WARNING',
  status: 'OPEN',
  title: 'Low battery',
  message: 'Battery entered warning threshold.',
  sourceTelemetryId: 't1',
  sourceEventId: 'e1',
  createdAt: '2026-08-15T18:00:00.000Z',
  acknowledgedAt: null,
  acknowledgedBy: null,
};

function expectReadonlySignal(value: object): void {
  expect(value).not.toHaveProperty('set');
  expect(value).not.toHaveProperty('update');
}

describe('AlertsFacade', () => {
  it('exposes read-only signals and mutates only through loadAlerts', async () => {
    const facade = new AlertsFacade({ getAlerts: () => of({ items: [sample] }) });
    expectReadonlySignal(facade.alerts);
    expectReadonlySignal(facade.loading);
    expectReadonlySignal(facade.error);
    expect(facade.alerts()).toEqual([]);

    await firstValueFrom(facade.loadAlerts());
    expect(facade.alerts()).toEqual([sample]);
  });

  it('loads open alerts once with limit 50', async () => {
    const getAlerts = jest.fn(() => of({ items: [sample] }));
    const facade = new AlertsFacade({ getAlerts } as AlertsDataSource);
    await firstValueFrom(facade.loadAlerts());
    expect(getAlerts).toHaveBeenCalledWith({ status: 'OPEN', limit: 50 });
    expect(facade.alerts()).toEqual([sample]);
    expect(facade.error()).toBeNull();
  });

  it('records failure independently of fleet', async () => {
    const facade = new AlertsFacade({
      getAlerts: () => throwError(() => new Error('alerts unavailable')),
    });
    await firstValueFrom(facade.loadAlerts());
    expect(facade.alerts()).toEqual([]);
    expect(facade.error()).toBe('alerts unavailable');
  });
});
