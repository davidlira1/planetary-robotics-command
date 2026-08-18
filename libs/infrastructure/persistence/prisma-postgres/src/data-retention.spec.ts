import { CleanupRetainedData } from '@prc/application';
import {
  AlertSeverity,
  AlertStatus,
  AlertType,
  HealthDimensionStatus,
  RobotHealthStatus,
} from '@prc/domain';
import { PrismaClient } from '@prisma/client';
import { PrismaDataRetentionRepository } from './data-retention-repository';
import { seedRobots } from './seed';

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const NOW = new Date('2026-08-17T18:00:00.000Z');
const HOUR_MS = 60 * 60 * 1000;
const TELEMETRY_POINT = {
  schemaVersion: 1,
  positionX: 1,
  positionY: 2,
  positionZ: 3,
  batteryPercent: 80,
  temperatureCelsius: 40,
  signalStrengthDbm: -70,
  velocityMetersPerSecond: 1,
  headingDegrees: 10,
};

describeDb('data retention', () => {
  const prisma = new PrismaClient();
  const retention = new PrismaDataRetentionRepository(prisma);
  const cleanup = new CleanupRetainedData(retention);

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

  it('never deletes unpublished outbox rows regardless of age', async () => {
    await prisma.outboxMessage.create({
      data: {
        id: 'obx_ancient_unpublished',
        eventId: 'evt_ancient_unpublished',
        eventType: 'robot.telemetry.received',
        eventVersion: 1,
        occurredAt: new Date('2020-01-01T00:00:00.000Z'),
        correlationId: 'corr_ancient',
        causationId: 'cause_ancient',
        payloadJson: '{}',
        createdAt: new Date('2020-01-01T00:00:00.000Z'),
        publishedAt: null,
      },
    });

    const result = await cleanup.execute({
      now: NOW,
      telemetryRetentionMs: 2 * HOUR_MS,
      publishedOutboxRetentionMs: 2 * HOUR_MS,
      processedMessageRetentionMs: 24 * HOUR_MS,
    });

    expect(result.outboxDeleted).toBe(0);
    const row = await prisma.outboxMessage.findUnique({
      where: { id: 'obx_ancient_unpublished' },
    });
    expect(row).not.toBeNull();
    expect(row?.publishedAt).toBeNull();
  });

  it('deletes expired telemetry, published outbox, and processed messages only', async () => {
    await prisma.robotCurrentState.create({
      data: {
        robotId: 'D-04',
        positionX: 10,
        positionY: 20,
        positionZ: 30,
        batteryPercent: 55,
        temperatureCelsius: 40,
        signalStrengthDbm: -70,
        velocityMetersPerSecond: 2,
        headingDegrees: 90,
        recordedAt: new Date('2026-08-17T17:59:00.000Z'),
        receivedAt: new Date('2026-08-17T17:59:01.000Z'),
      },
    });
    await prisma.robotHealthState.create({
      data: {
        robotId: 'D-04',
        status: RobotHealthStatus.WARNING,
        batteryStatus: HealthDimensionStatus.WARNING,
        temperatureStatus: HealthDimensionStatus.NORMAL,
        signalStatus: HealthDimensionStatus.NORMAL,
        evaluatedFromTelemetryId: 'tel_old',
        evaluatedFromRecordedAt: new Date('2026-08-17T15:00:00.000Z'),
        updatedAt: new Date('2026-08-17T17:59:02.000Z'),
      },
    });
    await prisma.alert.create({
      data: {
        id: 'alrt_keep',
        robotId: 'D-04',
        type: AlertType.LOW_BATTERY,
        severity: AlertSeverity.WARNING,
        status: AlertStatus.OPEN,
        title: 'low battery',
        message: 'keep me',
        sourceTelemetryId: 'src_old',
        sourceEventId: 'evt_old_tel',
        createdAt: new Date('2026-08-17T15:00:00.000Z'),
      },
    });

    await prisma.robotTelemetry.createMany({
      data: [
        {
          id: 'tel_old',
          robotId: 'D-04',
          sourceTelemetryId: 'src_old',
          recordedAt: new Date('2026-08-17T15:00:00.000Z'),
          receivedAt: new Date('2026-08-17T15:00:01.000Z'),
          ...TELEMETRY_POINT,
        },
        {
          id: 'tel_recent',
          robotId: 'D-04',
          sourceTelemetryId: 'src_recent',
          recordedAt: new Date('2026-08-17T17:00:00.000Z'),
          receivedAt: new Date('2026-08-17T17:00:01.000Z'),
          ...TELEMETRY_POINT,
        },
      ],
    });

    await prisma.outboxMessage.createMany({
      data: [
        {
          id: 'obx_old_published',
          eventId: 'evt_old_published',
          eventType: 'robot.telemetry.received',
          eventVersion: 1,
          occurredAt: new Date('2026-08-17T15:00:00.000Z'),
          correlationId: 'corr_old_pub',
          causationId: 'cause_old_pub',
          payloadJson: '{}',
          createdAt: new Date('2026-08-17T15:00:00.000Z'),
          publishedAt: new Date('2026-08-17T15:00:05.000Z'),
        },
        {
          id: 'obx_recent_published',
          eventId: 'evt_recent_published',
          eventType: 'robot.telemetry.received',
          eventVersion: 1,
          occurredAt: new Date('2026-08-17T17:00:00.000Z'),
          correlationId: 'corr_recent_pub',
          causationId: 'cause_recent_pub',
          payloadJson: '{}',
          createdAt: new Date('2026-08-17T17:00:00.000Z'),
          publishedAt: new Date('2026-08-17T17:00:05.000Z'),
        },
        {
          id: 'obx_ancient_unpublished',
          eventId: 'evt_ancient_unpublished',
          eventType: 'robot.telemetry.received',
          eventVersion: 1,
          occurredAt: new Date('2020-01-01T00:00:00.000Z'),
          correlationId: 'corr_ancient',
          causationId: 'cause_ancient',
          payloadJson: '{}',
          createdAt: new Date('2020-01-01T00:00:00.000Z'),
          publishedAt: null,
        },
      ],
    });

    await prisma.processedMessage.createMany({
      data: [
        {
          consumer: 'health',
          eventId: 'evt_old_processed',
          processedAt: new Date('2026-08-16T17:00:00.000Z'),
        },
        {
          consumer: 'health',
          eventId: 'evt_recent_processed',
          processedAt: new Date('2026-08-17T12:00:00.000Z'),
        },
      ],
    });

    const result = await cleanup.execute({
      now: NOW,
      telemetryRetentionMs: 2 * HOUR_MS,
      publishedOutboxRetentionMs: 2 * HOUR_MS,
      processedMessageRetentionMs: 24 * HOUR_MS,
    });

    expect(result).toEqual({
      telemetryDeleted: 1,
      outboxDeleted: 1,
      processedMessagesDeleted: 1,
    });

    expect(await prisma.robotTelemetry.findMany({ select: { id: true } })).toEqual([
      { id: 'tel_recent' },
    ]);
    const outboxIds = (await prisma.outboxMessage.findMany({ select: { id: true } }))
      .map((row) => row.id)
      .sort();
    expect(outboxIds).toEqual(['obx_ancient_unpublished', 'obx_recent_published']);
    expect(
      await prisma.processedMessage.findMany({ select: { eventId: true } }),
    ).toEqual([{ eventId: 'evt_recent_processed' }]);

    expect(await prisma.robotCurrentState.count()).toBe(1);
    expect(await prisma.robotHealthState.count()).toBe(1);
    expect(await prisma.alert.count()).toBe(1);
    expect(await prisma.robot.count()).toBe(5);
  });
});
