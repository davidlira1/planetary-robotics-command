import { EvaluateRobotHealth, HEALTH_WORKER_CONSUMER } from '@prc/application';
import { PrismaClient } from '@prisma/client';
import { PrismaUnitOfWork, seedRobots } from './index';

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const silentLogger = {
  info() {},
  warn() {},
  error() {},
  debug() {},
};

function telemetryEvent(overrides: {
  eventId: string;
  telemetryId: string;
  sourceTelemetryId: string;
  recordedAt: string;
  batteryPercent: number;
}) {
  return {
    eventId: overrides.eventId,
    eventType: 'robot.telemetry.received' as const,
    eventVersion: 1 as const,
    occurredAt: overrides.recordedAt,
    correlationId: `corr_${overrides.eventId}`,
    causationId: overrides.telemetryId,
    payload: {
      robotId: 'D-04',
      telemetryId: overrides.telemetryId,
      sourceTelemetryId: overrides.sourceTelemetryId,
      telemetrySchemaVersion: 1 as const,
      recordedAt: overrides.recordedAt,
      receivedAt: overrides.recordedAt,
      position: { x: 1, y: 2, z: 3 },
      batteryPercent: overrides.batteryPercent,
      temperatureCelsius: 40,
      signalStrengthDbm: -70,
      velocityMetersPerSecond: 1,
      headingDegrees: 10,
    },
  };
}

describeDb('EvaluateRobotHealth first-ever concurrency', () => {
  const prisma = new PrismaClient();
  const uow = new PrismaUnitOfWork(prisma);
  const evaluate = new EvaluateRobotHealth(uow, silentLogger);

  beforeAll(async () => {
    await seedRobots(prisma);
  });

  beforeEach(async () => {
    await prisma.processedMessage.deleteMany();
    await prisma.alert.deleteMany();
    await prisma.robotHealthState.deleteMany();
    await prisma.outboxMessage.deleteMany();
    await prisma.robotTelemetry.deleteMany();
    await prisma.robotCurrentState.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('serializes two first-ever health events for the same robot', async () => {
    // Older WARNING sample and newer WARNING sample. Without Robot-row locking,
    // both can observe existing=null and each emit a LOW_BATTERY alert.
    const older = telemetryEvent({
      eventId: 'evt_first_older',
      telemetryId: 'tel_first_older',
      sourceTelemetryId: 'src_first_older',
      recordedAt: '2026-08-14T20:00:01.000Z',
      batteryPercent: 19,
    });
    const newer = telemetryEvent({
      eventId: 'evt_first_newer',
      telemetryId: 'tel_first_newer',
      sourceTelemetryId: 'src_first_newer',
      recordedAt: '2026-08-14T20:00:02.000Z',
      batteryPercent: 18,
    });

    await Promise.all([evaluate.execute(older), evaluate.execute(newer)]);

    const health = await prisma.robotHealthState.findUnique({
      where: { robotId: 'D-04' },
    });
    expect(health).not.toBeNull();
    expect(health!.status).toBe('WARNING');
    expect(health!.batteryStatus).toBe('WARNING');
    expect(health!.evaluatedFromRecordedAt.toISOString()).toBe(
      '2026-08-14T20:00:02.000Z',
    );
    expect(health!.evaluatedFromTelemetryId).toBe('tel_first_newer');

    // Serialized transitions: first WARNING creates one alert; second WARNING
    // does not treat previous as nonexistent.
    expect(await prisma.alert.count()).toBe(1);
    const alert = await prisma.alert.findFirst();
    expect(alert?.type).toBe('LOW_BATTERY');
    expect(alert?.severity).toBe('WARNING');

    const processed = await prisma.processedMessage.findMany({
      where: { consumer: HEALTH_WORKER_CONSUMER },
      orderBy: { eventId: 'asc' },
    });
    expect(processed.map((p) => p.eventId).sort()).toEqual([
      'evt_first_newer',
      'evt_first_older',
    ]);
  });
});
