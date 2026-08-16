import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DefaultService } from '@prc/api-client-angular';
import type { FleetSnapshot } from '../../../core/models';
import type { FleetDataSource } from './fleet-data-source';

@Injectable()
export class FleetHttpDataSource implements FleetDataSource {
  constructor(private readonly api: DefaultService) {}

  getFleet(): Observable<FleetSnapshot> {
    return this.api.apiV1FleetGet();
  }
}
