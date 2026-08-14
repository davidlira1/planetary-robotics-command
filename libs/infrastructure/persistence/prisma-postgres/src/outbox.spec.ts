import { IngestTelemetry } from '@prc/application';
import { PrismaClient } from '@prisma/client';
import {
  PrismaOutboxRepository,
  PrismaUnitOfWork,
  seedRobots,
} from './index';

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const silentLogger = {
  info() {},
  warn() {},
  error() {},
  debug() {},
};

describeDb('Outbox persistence', () => {
  const prisma = new PrismaClient();
  const uow = new PrismaUnitOfWork(prisma);
  const outbox = new PrismaOutboxRepository(prisma);
  const ingest = new IngestTelemetry(uow, silentLogger);

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

  it('atomically creates telemetry + outbox', async () => {
    await ingest.execute({
      sourceTelemetryId: 'obx-1',
      robotId: 'D-04',
      schemaVersion: 1,
      recordedAt: new Date('2026-08-13T20:00:00.000Z'),
      position: { x: 1, y: 2, z: 3 },
      batteryPercent: 80,
      temperatureCelsius: 40,
      signalStrengthDbm: -70,
      velocityMetersPerSecond: 1,
      headingDegrees: 10,
      requestId: 'req_test',
    });

    expect(await prisma.robotTelemetry.count()).toBe(1);
    expect(await prisma.outboxMessage.count()).toBe(1);
  });

  it('idempotent replay creates no second outbox row', async () => {
    const input = {
      sourceTelemetryId: 'obx-idem',
      robotId: 'D-04',
      schemaVersion: 1,
      recordedAt: new Date('2026-08-13T20:00:00.000Z'),
      position: { x: 1, y: 2, z: 3 },
      batteryPercent: 80,
      temperatureCelsius: 40,
      signalStrengthDbm: -70,
      velocityMetersPerSecond: 1,
      headingDegrees: 10,
    };
    await ingest.execute(input);
    await ingest.execute(input);
    expect(await prisma.outboxMessage.count()).toBe(1);
  });

  it('claim then markPublished outside broker I/O', async () => {
    await ingest.execute({
      sourceTelemetryId: 'obx-claim',
      robotId: 'D-04',
      schemaVersion: 1,
      recordedAt: new Date('2026-08-13T20:00:00.000Z'),
      position: { x: 1, y: 2, z: 3 },
      batteryPercent: 80,
      temperatureCelsius: 40,
      signalStrengthDbm: -70,
      velocityMetersPerSecond: 1,
      headingDegrees: 10,
    });

    const claimed = await outbox.claimPending(10, 30_000);
    expect(claimed).toHaveLength(1);
    await outbox.markPublished(claimed[0].id, new Date());
    const row = await prisma.outboxMessage.findUnique({
      where: { id: claimed[0].id },
    });
    expect(row?.publishedAt).not.toBeNull();
  });

  it('recordPublishFailure increments attempts and clears claim', async () => {
    await ingest.execute({
      sourceTelemetryId: 'obx-fail',
      robotId: 'D-04',
      schemaVersion: 1,
      recordedAt: new Date('2026-08-13T20:00:00.000Z'),
      position: { x: 1, y: 2, z: 3 },
      batteryPercent: 80,
      temperatureCelsius: 40,
      signalStrengthDbm: -70,
      velocityMetersPerSecond: 1,
      headingDegrees: 10,
    });
    const claimed = await outbox.claimPending(10, 30_000);
    await outbox.recordPublishFailure(claimed[0].id, 'broker down');
    const row = await prisma.outboxMessage.findUnique({
      where: { id: claimed[0].id },
    });
    expect(row?.publishAttempts).toBe(1);
    expect(row?.claimedUntil).toBeNull();
    expect(row?.publishedAt).toBeNull();
  });
});
