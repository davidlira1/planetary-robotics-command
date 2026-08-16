import { computed, Inject, Injectable, signal } from '@angular/core';
import { catchError, finalize, map, Observable, of, tap } from 'rxjs';
import { mapHttpError } from '../../../core/error-mapping';
import type { FleetRobot } from '../../../core/models';
import { FLEET_DATA_SOURCE, type FleetDataSource } from '../data-access/fleet-data-source';

@Injectable()
export class FleetFacade {
  private readonly _robots = signal<readonly FleetRobot[]>([]);
  readonly robots = this._robots.asReadonly();

  private readonly _selectedRobotId = signal<string | null>(null);
  readonly selectedRobotId = this._selectedRobotId.asReadonly();

  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  private readonly _error = signal<string | null>(null);
  readonly error = this._error.asReadonly();

  private readonly _loadedAt = signal<Date | null>(null);
  readonly loadedAt = this._loadedAt.asReadonly();

  readonly selectedRobot = computed(() => {
    const id = this.selectedRobotId();
    if (!id) {
      return null;
    }
    return this.robots().find((robot) => robot.id === id) ?? null;
  });

  constructor(@Inject(FLEET_DATA_SOURCE) private readonly dataSource: FleetDataSource) {}

  loadFleet(): Observable<void> {
    this._loading.set(true);
    this._error.set(null);
    return this.dataSource.getFleet().pipe(
      tap((snapshot) => {
        const robots = snapshot.robots ?? [];
        this._robots.set(robots);
        this._loadedAt.set(new Date());
        const selected = this.selectedRobotId();
        if (selected && !robots.some((robot) => robot.id === selected)) {
          this._selectedRobotId.set(null);
        }
      }),
      map(() => undefined),
      catchError((error: unknown) => {
        this._error.set(mapHttpError(error));
        return of(undefined);
      }),
      finalize(() => this._loading.set(false)),
    );
  }

  selectRobot(robotId: string): void {
    if (!this.robots().some((robot) => robot.id === robotId)) {
      return;
    }
    this._selectedRobotId.set(robotId);
  }

  clearSelection(): void {
    this._selectedRobotId.set(null);
  }
}
