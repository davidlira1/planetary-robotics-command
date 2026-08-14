import { PrismaClient } from '@prisma/client';
import { PrismaRobotCurrentStateRepository } from './robot-current-state-repository';
import { PrismaRobotTelemetryRepository } from './robot-telemetry-repository';
import { PrismaUnitOfWork } from './unit-of-work';
import { seedRobots } from './seed';

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

describeDb('Prisma persistence integration', () => {
  const prisma = new PrismaClient();
  const currentState = new PrismaRobotCurrentStateRepository(prisma);
  const telemetry = new PrismaRobotTelemetryRepository(prisma);
  const uow = new PrismaUnitOfWork(prisma);

  beforeAll(async () => {
    await seedRobots(prisma);
  });

  beforeEach(async () => {
    await prisma.robotTelemetry.deleteMany();
    await prisma.robotCurrentState.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('updateIfNewer only advances on strictly newer recordedAt', async () => {
    const base = {
      robotId: 'D-04',
      position: { x: 1, y: 2, z: 3 },
      batteryPercent: 50,
      temperatureCelsius: 40,
      signalStrengthDbm: -60,
      velocityMetersPerSecond: 1,
      headingDegrees: 10,
      recordedAt: new Date('2026-08-13T20:00:03.000Z'),
      receivedAt: new Date('2026-08-13T20:00:03.100Z'),
    };

    await currentState.updateIfNewer(base);
    await currentState.updateIfNewer({
      ...base,
      batteryPercent: 10,
      recordedAt: new Date('2026-08-13T20:00:02.000Z'),
    });
    await currentState.updateIfNewer({
      ...base,
      batteryPercent: 11,
      recordedAt: new Date('2026-08-13T20:00:03.000Z'),
    });
    await currentState.updateIfNewer({
      ...base,
      batteryPercent: 90,
      recordedAt: new Date('2026-08-13T20:00:04.000Z'),
    });

    const state = await currentState.findByRobotId('D-04');
    expect(state?.batteryPercent).toBe(90);
  });

  it('rolls back telemetry append when later step fails', async () => {
    await expect(
      uow.execute(async (repos) => {
        await repos.telemetry.append({
          id: 'tel_rollback_test',
          robotId: 'D-04',
          sourceTelemetryId: 'rollback-1',
          schemaVersion: 1,
          position: { x: 1, y: 2, z: 3 },
          batteryPercent: 50,
          temperatureCelsius: 40,
          signalStrengthDbm: -60,
          velocityMetersPerSecond: 1,
          headingDegrees: 10,
          recordedAt: new Date('2026-08-13T20:00:03.000Z'),
          receivedAt: new Date('2026-08-13T20:00:03.100Z'),
        });
        throw new Error('simulated failure');
      }),
    ).rejects.toThrow('simulated failure');

    expect(await prisma.robotTelemetry.count()).toBe(0);
  });

  it('enforces unique (robotId, sourceTelemetryId)', async () => {
    const row = {
      id: 'tel_unique_1',
      robotId: 'D-04',
      sourceTelemetryId: 'src-unique',
      schemaVersion: 1,
      position: { x: 1, y: 2, z: 3 },
      batteryPercent: 50,
      temperatureCelsius: 40,
      signalStrengthDbm: -60,
      velocityMetersPerSecond: 1,
      headingDegrees: 10,
      recordedAt: new Date('2026-08-13T20:00:03.000Z'),
      receivedAt: new Date('2026-08-13T20:00:03.100Z'),
    };
    await telemetry.append(row);
    await expect(
      telemetry.append({ ...row, id: 'tel_unique_2' }),
    ).rejects.toThrow();
  });
});
