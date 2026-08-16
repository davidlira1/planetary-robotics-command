import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { DefaultService } from '@prc/api-client-angular';
import type { AlertsQuery, AlertsResult } from '../../../core/models';
import type { AlertsDataSource } from './alerts-data-source';

@Injectable()
export class AlertsHttpDataSource implements AlertsDataSource {
  constructor(private readonly api: DefaultService) {}

  getAlerts(query: AlertsQuery): Observable<AlertsResult> {
    return this.api.apiV1AlertsGet(undefined, undefined, query.status, query.limit).pipe(
      map((response: { items?: AlertsResult['items'] }) => ({ items: response.items ?? [] })),
    );
  }
}
