import { firstValueFrom, of } from 'rxjs';
import { FleetHttpDataSource } from './fleet-http-data-source';

describe('FleetHttpDataSource', () => {
  it('forwards the generated fleet response', async () => {
    const snapshot = { robots: [] };
    const api = { apiV1FleetGet: jest.fn(() => of(snapshot)) };
    const source = new FleetHttpDataSource(api as never);
    await expect(firstValueFrom(source.getFleet())).resolves.toEqual(snapshot);
    expect(api.apiV1FleetGet).toHaveBeenCalledTimes(1);
  });
});
