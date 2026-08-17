import { computed, Inject, Injectable, signal } from '@angular/core';
import type { RobotStateUpdatedV1 } from '@prc/contracts';
import { catchError, finalize, map, Observable, of, tap } from 'rxjs';
import { mapHttpError } from '../../../core/error-mapping';
import type { FleetRobot, FleetRobotCurrentState } from '../../../core/models';
import { FLEET_DATA_SOURCE, type FleetDataSource } from '../data-access/fleet-data-source';
import { isNewerRecordedAt, newerCurrentState } from './recorded-at';

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

  private readonly latestState = new Map<string, FleetRobotCurrentState>();

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
        this.applyAuthoritativeSnapshot(robots);
        this._loadedAt.set(new Date());
        const selected = this.selectedRobotId();
        if (selected && !this._robots().some((robot) => robot.id === selected)) {
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

  applyRobotStateUpdated(message: RobotStateUpdatedV1): void {
    const incoming = message.robot.currentState;
    const existing = this.latestState.get(message.robot.id);
    if (existing && !isNewerRecordedAt(incoming.recordedAt, existing.recordedAt)) {
      return;
    }
    this.latestState.set(message.robot.id, incoming);
    const current = this._robots();
    if (!current.some((robot) => robot.id === message.robot.id)) {
      return;
    }
    this._robots.set(
      current.map((robot) =>
        robot.id === message.robot.id ? { ...robot, currentState: incoming } : robot,
      ),
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

  private applyAuthoritativeSnapshot(robots: readonly FleetRobot[]): void {
    const merged = robots.map((robot) => {
      const currentState = newerCurrentState(robot.currentState, this.latestState.get(robot.id));
      if (currentState) {
        this.latestState.set(robot.id, currentState);
      }
      return { ...robot, currentState };
    });
    const present = new Set(merged.map((robot) => robot.id));
    for (const id of [...this.latestState.keys()]) {
      if (!present.has(id)) {
        this.latestState.delete(id);
      }
    }
    this._robots.set(merged);
  }
}
