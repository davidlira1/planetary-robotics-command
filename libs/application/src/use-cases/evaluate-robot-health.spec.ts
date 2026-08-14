import {
  HealthDimensionStatus,
  RobotHealthState,
  RobotHealthStatus,
} from '@prc/domain';
import {
  AlertRepository,
  Logger,
  OutboxRepository,
  ProcessedMessageRepository,
  RobotCurrentStateRepository,
  RobotHealthRepository,
  RobotRepository,
  RobotTelemetryRepository,
  TransactionalRepos,
  UnitOfWork,
} from '@prc/ports';
import {
  EvaluateRobotHealth,
  classifyBattery,
  classifySignal,
  classifyTemperature,
  overallStatus,
} from './evaluate-robot-health';

const silentLogger: Logger = {
  info() {},
  warn() {},
  error() {},
  debug() {},
};

class MemHealth implements RobotHealthRepository {
  state: RobotHealthState | null = null;
  async findByRobotIdForUpdate() {
    return this.state;
  }
  async updateIfNewer(next: RobotHealthState) {
    if (
      !this.state ||
      next.evaluatedFromRecordedAt.getTime() >
        this.state.evaluatedFromRecordedAt.getTime()
    ) {
      this.state = next;
    }
  }
}

class MemAlerts implements AlertRepository {
  rows: unknown[] = [];
  async append(a: unknown) {
    this.rows.push(a);
  }
  async countByRobotAndType() {
    return this.rows.length;
  }
}

class MemProcessed implements ProcessedMessageRepository {
  seen = new Set<string>();
  async tryBeginProcessing(consumer: string, eventId: string) {
    const key = `${consumer}:${eventId}`;
    if (this.seen.has(key)) return { acquired: false as const, reason: 'duplicate' as const };
    this.seen.add(key);
    return { acquired: true as const };
  }
}

function repos(
  health: MemHealth,
  alerts: MemAlerts,
  processed: MemProcessed,
): TransactionalRepos {
  const robots: RobotRepository = {
    async findAll() {
      return { items: [], nextCursorId: null };
    },
    async findById() {
      return null;
    },
    async exists() {
      return true;
    },
    async lockById() {},
  };
  const unused = {} as RobotCurrentStateRepository &
    RobotTelemetryRepository &
    OutboxRepository;
  return {
    robots,
    currentState: unused as RobotCurrentStateRepository,
    telemetry: unused as RobotTelemetryRepository,
    outbox: unused as OutboxRepository,
    health,
    alerts,
    processedMessages: processed,
  };
}

class Uow implements UnitOfWork {
  constructor(private readonly r: TransactionalRepos) {}
  execute<T>(fn: (repos: TransactionalRepos) => Promise<T>) {
    return fn(this.r);
  }
}

function event(overrides: {
  eventId?: string;
  payload?: Record<string, unknown>;
} = {}) {
  const payload = {
    robotId: 'D-04',
    telemetryId: 'tel_1',
    sourceTelemetryId: 'src_1',
    telemetrySchemaVersion: 1 as const,
    recordedAt: '2026-08-13T20:00:03.000Z',
    receivedAt: '2026-08-13T20:00:03.100Z',
    position: { x: 1, y: 2, z: 3 },
    batteryPercent: 80,
    temperatureCelsius: 50,
    signalStrengthDbm: -70,
    velocityMetersPerSecond: 1,
    headingDegrees: 90,
    ...overrides.payload,
  };
  return {
    eventId: overrides.eventId ?? 'evt_1',
    eventType: 'robot.telemetry.received' as const,
    eventVersion: 1 as const,
    occurredAt: '2026-08-13T20:00:03.100Z',
    correlationId: 'req_1',
    causationId: String(payload.telemetryId),
    payload,
  };
}

describe('health classification', () => {
  it('classifies battery bands', () => {
    expect(classifyBattery(80)).toBe(HealthDimensionStatus.NORMAL);
    expect(classifyBattery(19)).toBe(HealthDimensionStatus.WARNING);
    expect(classifyBattery(9)).toBe(HealthDimensionStatus.CRITICAL);
  });

  it('classifies temperature bands', () => {
    expect(classifyTemperature(70)).toBe(HealthDimensionStatus.NORMAL);
    expect(classifyTemperature(85)).toBe(HealthDimensionStatus.WARNING);
    expect(classifyTemperature(96)).toBe(HealthDimensionStatus.CRITICAL);
  });

  it('classifies signal bands', () => {
    expect(classifySignal(-80)).toBe(HealthDimensionStatus.NORMAL);
    expect(classifySignal(-95)).toBe(HealthDimensionStatus.WARNING);
    expect(classifySignal(-110)).toBe(HealthDimensionStatus.CRITICAL);
  });

  it('derives overall status', () => {
    expect(
      overallStatus(
        HealthDimensionStatus.NORMAL,
        HealthDimensionStatus.NORMAL,
        HealthDimensionStatus.NORMAL,
      ),
    ).toBe(RobotHealthStatus.HEALTHY);
    expect(
      overallStatus(
        HealthDimensionStatus.WARNING,
        HealthDimensionStatus.NORMAL,
        HealthDimensionStatus.NORMAL,
      ),
    ).toBe(RobotHealthStatus.WARNING);
    expect(
      overallStatus(
        HealthDimensionStatus.WARNING,
        HealthDimensionStatus.CRITICAL,
        HealthDimensionStatus.NORMAL,
      ),
    ).toBe(RobotHealthStatus.CRITICAL);
  });
});

describe('EvaluateRobotHealth', () => {
  let health: MemHealth;
  let alerts: MemAlerts;
  let processed: MemProcessed;
  let useCase: EvaluateRobotHealth;

  beforeEach(() => {
    health = new MemHealth();
    alerts = new MemAlerts();
    processed = new MemProcessed();
    useCase = new EvaluateRobotHealth(
      new Uow(repos(health, alerts, processed)),
      silentLogger,
    );
  });

  it('sets HEALTHY and creates no alert for normal battery', async () => {
    await useCase.execute(event({ payload: { batteryPercent: 80 } }));
    expect(health.state?.status).toBe(RobotHealthStatus.HEALTHY);
    expect(alerts.rows).toHaveLength(0);
  });

  it('HEALTHY -> WARNING creates one battery alert', async () => {
    await useCase.execute(event({ eventId: 'evt_a', payload: { batteryPercent: 80 } }));
    await useCase.execute(
      event({
        eventId: 'evt_b',
        payload: {
          batteryPercent: 19,
          recordedAt: '2026-08-13T20:00:04.000Z',
          telemetryId: 'tel_2',
          sourceTelemetryId: 'src_2',
        },
      }),
    );
    expect(health.state?.status).toBe(RobotHealthStatus.WARNING);
    expect(alerts.rows).toHaveLength(1);
  });

  it('WARNING -> WARNING creates no duplicate alert', async () => {
    await useCase.execute(
      event({
        eventId: 'evt_a',
        payload: { batteryPercent: 19, recordedAt: '2026-08-13T20:00:03.000Z' },
      }),
    );
    await useCase.execute(
      event({
        eventId: 'evt_b',
        payload: {
          batteryPercent: 18,
          recordedAt: '2026-08-13T20:00:04.000Z',
          telemetryId: 'tel_2',
          sourceTelemetryId: 'src_2',
        },
      }),
    );
    expect(alerts.rows).toHaveLength(1);
  });

  it('WARNING -> CRITICAL creates critical alert', async () => {
    await useCase.execute(
      event({
        eventId: 'evt_a',
        payload: { batteryPercent: 19, recordedAt: '2026-08-13T20:00:03.000Z' },
      }),
    );
    await useCase.execute(
      event({
        eventId: 'evt_b',
        payload: {
          batteryPercent: 8,
          recordedAt: '2026-08-13T20:00:05.000Z',
          telemetryId: 'tel_2',
          sourceTelemetryId: 'src_2',
        },
      }),
    );
    expect(health.state?.status).toBe(RobotHealthStatus.CRITICAL);
    expect(alerts.rows).toHaveLength(2);
  });

  it('older telemetry does not regress health', async () => {
    await useCase.execute(
      event({
        eventId: 'evt_new',
        payload: { batteryPercent: 8, recordedAt: '2026-08-13T20:00:05.000Z' },
      }),
    );
    await useCase.execute(
      event({
        eventId: 'evt_old',
        payload: {
          batteryPercent: 90,
          recordedAt: '2026-08-13T20:00:01.000Z',
          telemetryId: 'tel_old',
          sourceTelemetryId: 'src_old',
        },
      }),
    );
    expect(health.state?.status).toBe(RobotHealthStatus.CRITICAL);
    expect(health.state?.batteryStatus).toBe(HealthDimensionStatus.CRITICAL);
  });

  it('equal timestamp keeps existing state', async () => {
    await useCase.execute(
      event({
        eventId: 'evt_a',
        payload: { batteryPercent: 80, recordedAt: '2026-08-13T20:00:03.000Z' },
      }),
    );
    await useCase.execute(
      event({
        eventId: 'evt_b',
        payload: {
          batteryPercent: 8,
          recordedAt: '2026-08-13T20:00:03.000Z',
          telemetryId: 'tel_2',
          sourceTelemetryId: 'src_2',
        },
      }),
    );
    expect(health.state?.status).toBe(RobotHealthStatus.HEALTHY);
  });

  it('duplicate event is idempotent', async () => {
    const e = event({ payload: { batteryPercent: 19 } });
    await useCase.execute(e);
    await useCase.execute(e);
    expect(alerts.rows).toHaveLength(1);
  });
});
