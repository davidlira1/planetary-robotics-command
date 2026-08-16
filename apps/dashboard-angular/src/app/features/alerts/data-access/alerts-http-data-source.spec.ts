import { of } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { AlertsHttpDataSource } from './alerts-http-data-source';

describe('AlertsHttpDataSource', () => {
  it('maps generated items and requests OPEN / 50', async () => {
    const items = [{ id: 'a1' }];
    const api = {
      apiV1AlertsGet: jest.fn(() => of({ items, page: { nextCursor: null, hasMore: false } })),
    };
    const source = new AlertsHttpDataSource(api as never);
    await expect(firstValueFrom(source.getAlerts({ status: 'OPEN', limit: 50 }))).resolves.toEqual({
      items,
    });
    expect(api.apiV1AlertsGet).toHaveBeenCalledWith(undefined, undefined, 'OPEN', 50);
  });
});
