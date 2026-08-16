import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import type { FleetSnapshot } from '../../../core/models';

export interface FleetDataSource {
  getFleet(): Observable<FleetSnapshot>;
}

export const FLEET_DATA_SOURCE = new InjectionToken<FleetDataSource>('FLEET_DATA_SOURCE');
