import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import type { AlertsQuery, AlertsResult } from '../../../core/models';

export interface AlertsDataSource {
  getAlerts(query: AlertsQuery): Observable<AlertsResult>;
}

export const ALERTS_DATA_SOURCE = new InjectionToken<AlertsDataSource>('ALERTS_DATA_SOURCE');
