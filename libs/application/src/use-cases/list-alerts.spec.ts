import {
  Alert,
  AlertSeverity,
  AlertStatus,
  AlertType,
  HealthDimensionStatus,
  Robot,
  RobotHealthState,
  RobotHealthStatus,
  RobotOperationalStatus,
  RobotType,
} from '@prc/domain';
import {
  AlertListQuery,
  AlertListResult,
  AlertRepository,
  RobotCurrentStateRepository,
  RobotHealthRepository,
  RobotRepository,
} from '@prc/ports';
import { RobotNotFoundError } from '../errors';
import { encodeAlertCursor } from '../pagination';
import { GetRobot } from './get-robot';
import { ListAlerts } from './list-alerts';

const robot: Robot = {
  id: 'D-04',
  displayName: 'D-04',
  type: RobotType.DRONE,
  model: 'AX-4',
  operationalStatus: RobotOperationalStatus.ACTIVE,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const health: RobotHealthState = {
  robotId: 'D-04',
  status: RobotHealthStatus.WARNING,
  batteryStatus: HealthDimensionStatus.WARNING,
  temperatureStatus: HealthDimensionStatus.NORMAL,
  signalStatus: HealthDimensionStatus.NORMAL,
  evaluatedFromTelemetryId: 'tel_1',
  evaluatedFromRecordedAt: new Date('2026-08-14T20:00:00.000Z'),
  updatedAt: new Date('2026-08-14T20:00:01.000Z'),
};

describe('GetRobot', () => {
  it('includes health when present', async () => {
    const robots: RobotRepository = {
      async findAll() {
        return { items: [], nextCursorId: null };
      },
      async findById() {
        return robot;
      },
      async exists() {
        return true;
      },
      async lockById() {},
    };
    const currentState: RobotCurrentStateRepository = {
      async findByRobotId() {
        return null;
      },
      async updateIfNewer() {},
    };
    const healthRepo: RobotHealthRepository = {
      async findByRobotId() {
        return health;
      },
      async findByRobotIdForUpdate() {
        return health;
      },
      async updateIfNewer() {},
    };

    const result = await new GetRobot(robots, currentState, healthRepo).execute(
      'D-04',
    );
    expect(result.health?.status).toBe(RobotHealthStatus.WARNING);
    expect(result.currentState).toBeNull();
  });

  it('returns null health when missing and 404 when robot missing', async () => {
    const robots: RobotRepository = {
      async findAll() {
        return { items: [], nextCursorId: null };
      },
      async findById(id: string) {
        return id === 'D-04' ? robot : null;
      },
      async exists() {
        return true;
      },
      async lockById() {},
    };
    const currentState: RobotCurrentStateRepository = {
      async findByRobotId() {
        return null;
      },
      async updateIfNewer() {},
    };
    const healthRepo: RobotHealthRepository = {
      async findByRobotId() {
        return null;
      },
      async findByRobotIdForUpdate() {
        return null;
      },
      async updateIfNewer() {},
    };

    const ok = await new GetRobot(robots, currentState, healthRepo).execute(
      'D-04',
    );
    expect(ok.health).toBeNull();

    await expect(
      new GetRobot(robots, currentState, healthRepo).execute('NOPE'),
    ).rejects.toBeInstanceOf(RobotNotFoundError);
  });
});

function alert(
  id: string,
  createdAt: string,
  overrides: Partial<Alert> = {},
): Alert {
  return {
    id,
    robotId: 'D-04',
    type: AlertType.LOW_BATTERY,
    severity: AlertSeverity.WARNING,
    status: AlertStatus.OPEN,
    title: 'LOW_BATTERY WARNING',
    message: 'Battery low',
    sourceTelemetryId: `src_${id}`,
    sourceEventId: `evt_${id}`,
    createdAt: new Date(createdAt),
    acknowledgedAt: null,
    acknowledgedBy: null,
    ...overrides,
  };
}

describe('ListAlerts', () => {
  it('returns newest first and supports filters + cursor', async () => {
    const a1 = alert('alrt_1', '2026-08-14T20:00:02.000Z');
    const a2 = alert('alrt_2', '2026-08-14T20:00:01.000Z', {
      robotId: 'H-17',
      severity: AlertSeverity.CRITICAL,
    });
    const a3 = alert('alrt_3', '2026-08-14T20:00:01.000Z'); // same timestamp as a2

    const stored = [a1, a2, a3];

    const alerts: AlertRepository = {
      async append() {},
      async countByRobotAndType() {
        return 0;
      },
      async list(query: AlertListQuery): Promise<AlertListResult> {
        let items = [...stored];
        if (query.robotId) {
          items = items.filter((a) => a.robotId === query.robotId);
        }
        if (query.severity) {
          items = items.filter((a) => a.severity === query.severity);
        }
        if (query.status) {
          items = items.filter((a) => a.status === query.status);
        }
        items.sort((x, y) => {
          const t = y.createdAt.getTime() - x.createdAt.getTime();
          if (t !== 0) return t;
          return y.id < x.id ? -1 : y.id > x.id ? 1 : 0;
        });
        if (query.cursor) {
          items = items.filter((a) => {
            const t = a.createdAt.getTime() - query.cursor!.createdAt.getTime();
            if (t < 0) return true;
            if (t > 0) return false;
            return a.id < query.cursor!.alertId;
          });
        }
        const hasMore = items.length > query.limit;
        const page = items.slice(0, query.limit);
        const last = page[page.length - 1];
        return {
          items: page,
          nextCursor:
            hasMore && last
              ? { createdAt: last.createdAt, alertId: last.id }
              : null,
        };
      },
    };

    const useCase = new ListAlerts(alerts);

    const all = await useCase.execute({ limit: 10 });
    expect(all.items.map((a) => a.id)).toEqual(['alrt_1', 'alrt_3', 'alrt_2']);

    const filtered = await useCase.execute({
      limit: 10,
      robotId: 'D-04',
      severity: AlertSeverity.WARNING,
      status: AlertStatus.OPEN,
    });
    expect(filtered.items.map((a) => a.id)).toEqual(['alrt_1', 'alrt_3']);

    const page1 = await useCase.execute({ limit: 1 });
    expect(page1.items).toHaveLength(1);
    expect(page1.page.nextCursor).toBeTruthy();

    const page2 = await useCase.execute({
      limit: 1,
      cursor: page1.page.nextCursor!,
    });
    expect(page2.items[0]!.id).toBe('alrt_3');

    // identical createdAt paginates deterministically via id
    const tiedCursor = encodeAlertCursor(
      new Date('2026-08-14T20:00:01.000Z'),
      'alrt_3',
    );
    const afterTied = await useCase.execute({ limit: 10, cursor: tiedCursor });
    expect(afterTied.items.map((a) => a.id)).toEqual(['alrt_2']);
  });

  it('rejects invalid cursor', async () => {
    const alerts: AlertRepository = {
      async append() {},
      async countByRobotAndType() {
        return 0;
      },
      async list() {
        return { items: [], nextCursor: null };
      },
    };
    await expect(
      new ListAlerts(alerts).execute({ limit: 10, cursor: 'not-a-cursor' }),
    ).rejects.toThrow(/Invalid alert list cursor/);
  });
});
