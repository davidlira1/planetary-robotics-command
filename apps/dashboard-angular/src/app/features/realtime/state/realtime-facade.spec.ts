import { Observable, Subject } from 'rxjs';
import type { RobotStateUpdatedV1 } from '@prc/contracts';
import type { FleetRealtimeDataSource } from '../../fleet/data-access/fleet-realtime-data-source';
import type { FleetFacade } from '../../fleet/state/fleet-facade';
import type { RealtimeConnectionState } from '../realtime-connection-state';
import { RealtimeFacade } from './realtime-facade';

describe('RealtimeFacade', () => {
  it('disconnects the data source on destroy', () => {
    const disconnect = jest.fn();
    const connect = jest.fn();
    const dataSource: FleetRealtimeDataSource = {
      connectionState$: new Subject<RealtimeConnectionState>().asObservable(),
      messages$: new Subject<RobotStateUpdatedV1>().asObservable(),
      reconnected$: new Subject<void>().asObservable(),
      connect,
      disconnect,
    };
    const fleet = { applyRobotStateUpdated: jest.fn(), loadFleet: jest.fn() } as unknown as FleetFacade;
    const facade = new RealtimeFacade(dataSource, fleet);
    facade.connect();
    expect(connect).toHaveBeenCalledTimes(1);
    facade.ngOnDestroy();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('cancels an in-flight snapshot when another reconnect arrives', () => {
    const reconnected = new Subject<void>();
    let unsubscribed = 0;
    const loadFleet = jest.fn(
      () =>
        new Observable<void>(() => {
          return () => {
            unsubscribed += 1;
          };
        }),
    );
    const dataSource: FleetRealtimeDataSource = {
      connectionState$: new Subject<RealtimeConnectionState>().asObservable(),
      messages$: new Subject<RobotStateUpdatedV1>().asObservable(),
      reconnected$: reconnected.asObservable(),
      connect: jest.fn(),
      disconnect: jest.fn(),
    };
    const fleet = { applyRobotStateUpdated: jest.fn(), loadFleet } as unknown as FleetFacade;
    const facade = new RealtimeFacade(dataSource, fleet);
    facade.connect();
    reconnected.next();
    reconnected.next();
    expect(loadFleet).toHaveBeenCalledTimes(2);
    expect(unsubscribed).toBe(1);
    facade.ngOnDestroy();
  });
});
