import { Inject, Injectable, OnDestroy, signal } from '@angular/core';
import { Subscription, switchMap } from 'rxjs';
import { FleetFacade } from '../../fleet/state/fleet-facade';
import {
  FLEET_REALTIME_DATA_SOURCE,
  type FleetRealtimeDataSource,
} from '../../fleet/data-access/fleet-realtime-data-source';
import type { RealtimeConnectionState } from '../realtime-connection-state';

@Injectable()
export class RealtimeFacade implements OnDestroy {
  private readonly subscriptions = new Subscription();
  private started = false;

  private readonly _connectionState = signal<RealtimeConnectionState>('DISCONNECTED');
  readonly connectionState = this._connectionState.asReadonly();

  constructor(
    @Inject(FLEET_REALTIME_DATA_SOURCE) private readonly dataSource: FleetRealtimeDataSource,
    private readonly fleet: FleetFacade,
  ) {}

  connect(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.subscriptions.add(
      this.dataSource.connectionState$.subscribe((state) => this._connectionState.set(state)),
    );
    this.subscriptions.add(
      this.dataSource.messages$.subscribe((message) => this.fleet.applyRobotStateUpdated(message)),
    );
    this.subscriptions.add(
      this.dataSource.reconnected$
        .pipe(switchMap(() => this.fleet.loadFleet()))
        .subscribe(),
    );
    this.dataSource.connect();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.dataSource.disconnect();
  }
}
