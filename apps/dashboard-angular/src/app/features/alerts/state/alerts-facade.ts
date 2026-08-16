import { Inject, Injectable, signal } from '@angular/core';
import { catchError, finalize, map, Observable, of, tap } from 'rxjs';
import { mapHttpError } from '../../../core/error-mapping';
import type { FleetAlert } from '../../../core/models';
import { ALERTS_DATA_SOURCE, type AlertsDataSource } from '../data-access/alerts-data-source';

@Injectable()
export class AlertsFacade {
  private readonly _alerts = signal<readonly FleetAlert[]>([]);
  readonly alerts = this._alerts.asReadonly();

  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  private readonly _error = signal<string | null>(null);
  readonly error = this._error.asReadonly();

  constructor(@Inject(ALERTS_DATA_SOURCE) private readonly dataSource: AlertsDataSource) {}

  loadAlerts(): Observable<void> {
    this._loading.set(true);
    this._error.set(null);
    return this.dataSource.getAlerts({ status: 'OPEN', limit: 50 }).pipe(
      tap((result) => this._alerts.set(result.items)),
      map(() => undefined),
      catchError((error: unknown) => {
        this._error.set(mapHttpError(error));
        return of(undefined);
      }),
      finalize(() => this._loading.set(false)),
    );
  }
}
