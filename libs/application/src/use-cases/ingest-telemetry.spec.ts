import {
  RobotCurrentState,
  RobotOperationalStatus,
  RobotTelemetry,
  RobotType,
} from '@prc/domain';
import {
  AlertRepository,
  Logger,
  OutboxMessage,
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
  IdempotencyConflictError,
  IngestTelemetry,
  RobotNotFoundError,
} from '../index';

class InMemoryRobots implements RobotRepository {
  constructor(private readonly ids: Set<string>) {}
  async findAll() {
    return { items: [], nextCursorId: null };
  }
  async findById(robotId: string) {
    if (!this.ids.has(robotId)) return null;
    return {
      id: robotId,
      displayName: robotId,
      type: RobotType.DRONE,
      model: 'test',
      operationalStatus: RobotOperationalStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  async exists(robotId: string) {
    return this.ids.has(robotId);
  }
  async lockById(robotId: string) {
    if (!this.ids.has(robotId)) {
      throw new Error(`Robot ${robotId} does not exist`);
    }
  }
}

class InMemoryCurrentState implements RobotCurrentStateRepository {
  store = new Map<string, RobotCurrentState>();
  async findByRobotId(robotId: string) {
    return this.store.get(robotId) ?? null;
  }
  async updateIfNewer(state: RobotCurrentState) {
    const existing = this.store.get(state.robotId);
    if (!existing || state.recordedAt.getTime() > existing.recordedAt.getTime()) {
      this.store.set(state.robotId, state);
    }
  }
}

class InMemoryTelemetry implements RobotTelemetryRepository {
  rows: RobotTelemetry[] = [];
  async append(telemetry: RobotTelemetry) {
    this.rows.push(telemetry);
  }
  async findByRobotIdAndSource(robotId: string, sourceTelemetryId: string) {
    return (
      this.rows.find(
        (r) =>
          r.robotId === robotId && r.sourceTelemetryId === sourceTelemetryId,
      ) ?? null
    );
  }
  async findByRobotId() {
    return { items: [], nextCursor: null };
  }
}

class InMemoryOutbox implements OutboxRepository {
  rows: OutboxMessage[] = [];
  async append(message: OutboxMessage) {
    this.rows.push(message);
  }
  async claimPending() {
    return [];
  }
  async markPublished() {}
  async recordPublishFailure() {}
}

const noopHealth: RobotHealthRepository = {
  async findByRobotIdForUpdate() {
    return null;
  },
  async updateIfNewer() {},
};
const noopAlerts: AlertRepository = {
  async append() {},
  async countByRobotAndType() {
    return 0;
  },
};
const noopProcessed: ProcessedMessageRepository = {
  async tryBeginProcessing() {
    return { acquired: true };
  },
};

class InMemoryUow implements UnitOfWork {
  constructor(private readonly repos: TransactionalRepos) {}
  async execute<T>(fn: (repos: TransactionalRepos) => Promise<T>): Promise<T> {
    return fn(this.repos);
  }
}

const silentLogger: Logger = {
  info() {},
  warn() {},
  error() {},
  debug() {},
};

function baseInput(overrides: Partial<Parameters<IngestTelemetry['execute']>[0]> = {}) {
  return {
    sourceTelemetryId: 'D04-SRC-1',
    robotId: 'D-04',
    schemaVersion: 1,
    recordedAt: new Date('2026-08-13T20:00:03.000Z'),
    position: { x: 1, y: 2, z: 3 },
    batteryPercent: 80,
    temperatureCelsius: 50,
    signalStrengthDbm: -70,
    velocityMetersPerSecond: 1,
    headingDegrees: 90,
    ...overrides,
  };
}

describe('IngestTelemetry', () => {
  let robots: InMemoryRobots;
  let currentState: InMemoryCurrentState;
  let telemetry: InMemoryTelemetry;
  let outbox: InMemoryOutbox;
  let useCase: IngestTelemetry;

  beforeEach(() => {
    robots = new InMemoryRobots(new Set(['D-04']));
    currentState = new InMemoryCurrentState();
    telemetry = new InMemoryTelemetry();
    outbox = new InMemoryOutbox();
    useCase = new IngestTelemetry(
      new InMemoryUow({
        robots,
        currentState,
        telemetry,
        outbox,
        health: noopHealth,
        alerts: noopAlerts,
        processedMessages: noopProcessed,
      }),
      silentLogger,
    );
  });

  it('accepts valid telemetry, updates current state, and appends outbox', async () => {
    const result = await useCase.execute(baseInput());
    expect(result.status).toBe('ACCEPTED');
    expect(telemetry.rows).toHaveLength(1);
    expect(outbox.rows).toHaveLength(1);
    expect(JSON.parse(outbox.rows[0].payloadJson).eventType).toBe(
      'robot.telemetry.received',
    );
    expect(currentState.store.get('D-04')?.batteryPercent).toBe(80);
  });

  it('rejects unknown robots', async () => {
    await expect(useCase.execute(baseInput({ robotId: 'D-99' }))).rejects.toBeInstanceOf(
      RobotNotFoundError,
    );
  });

  it('updates current state for newer recordedAt', async () => {
    await useCase.execute(baseInput());
    await useCase.execute(
      baseInput({
        sourceTelemetryId: 'D04-SRC-2',
        recordedAt: new Date('2026-08-13T20:00:04.000Z'),
        batteryPercent: 70,
      }),
    );
    expect(currentState.store.get('D-04')?.batteryPercent).toBe(70);
    expect(telemetry.rows).toHaveLength(2);
    expect(outbox.rows).toHaveLength(2);
  });

  it('keeps history but does not regress current state for older recordedAt', async () => {
    await useCase.execute(baseInput());
    await useCase.execute(
      baseInput({
        sourceTelemetryId: 'D04-SRC-older',
        recordedAt: new Date('2026-08-13T20:00:02.000Z'),
        batteryPercent: 10,
      }),
    );
    expect(telemetry.rows).toHaveLength(2);
    expect(currentState.store.get('D-04')?.batteryPercent).toBe(80);
  });

  it('keeps existing current state when recordedAt is equal', async () => {
    await useCase.execute(baseInput({ batteryPercent: 80 }));
    await useCase.execute(
      baseInput({
        sourceTelemetryId: 'D04-SRC-tie',
        recordedAt: new Date('2026-08-13T20:00:03.000Z'),
        batteryPercent: 10,
      }),
    );
    expect(telemetry.rows).toHaveLength(2);
    expect(currentState.store.get('D-04')?.batteryPercent).toBe(80);
  });

  it('returns existing telemetry for identical idempotent replay without second outbox', async () => {
    const first = await useCase.execute(baseInput());
    const second = await useCase.execute(baseInput());
    expect(second.telemetryId).toBe(first.telemetryId);
    expect(telemetry.rows).toHaveLength(1);
    expect(outbox.rows).toHaveLength(1);
  });

  it('throws IDEMPOTENCY_CONFLICT for conflicting payload under same source key', async () => {
    await useCase.execute(baseInput());
    await expect(
      useCase.execute(baseInput({ batteryPercent: 11 })),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
    expect(telemetry.rows).toHaveLength(1);
    expect(outbox.rows).toHaveLength(1);
  });
});
