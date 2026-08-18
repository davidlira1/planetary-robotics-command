import { PrismaClient } from '@prisma/client';
import {
  AlertSeverity,
  AlertStatus,
  AlertType,
  HealthDimensionStatus,
  RobotHealthStatus,
} from '@prc/domain';
import { PrismaAlertRepository } from './alert-repository';
import { PrismaFleetReadRepository } from './fleet-read-repository';
import { seedRobots } from './seed';

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

describeDb('Fleet and alert read repositories', () => {
  const prisma = new PrismaClient();
  const fleet = new PrismaFleetReadRepository(prisma);
  const alerts = new PrismaAlertRepository(prisma);

  beforeAll(async () => {
    await seedRobots(prisma);
  });

  beforeEach(async () => {
    await prisma.alert.deleteMany();
    await prisma.robotHealthState.deleteMany();
    await prisma.robotCurrentState.deleteMany();
    await prisma.robotTelemetry.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('getSnapshot maps robots with nullable state/health without N+1 loops', async () => {
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
        recordedAt: new Date('2026-08-14T20:00:00.000Z'),
        receivedAt: new Date('2026-08-14T20:00:01.000Z'),
      },
    });
    await prisma.robotHealthState.create({
      data: {
        robotId: 'D-04',
        status: RobotHealthStatus.WARNING,
        batteryStatus: HealthDimensionStatus.WARNING,
        temperatureStatus: HealthDimensionStatus.NORMAL,
        signalStatus: HealthDimensionStatus.NORMAL,
        evaluatedFromTelemetryId: 'tel_1',
        evaluatedFromRecordedAt: new Date('2026-08-14T20:00:00.000Z'),
        updatedAt: new Date('2026-08-14T20:00:02.000Z'),
      },
    });

    const snapshot = await fleet.getSnapshot();
    expect(snapshot.robots.map((r) => r.id)).toEqual([
      'D-04',
      'D-09',
      'H-17',
      'H-22',
      'M-12',
      'M-27',
      'S-03',
      'S-11',
      'W-08',
      'W-14',
    ]);
    const d04 = snapshot.robots.find((r) => r.id === 'D-04')!;
    expect(d04.currentState?.batteryPercent).toBe(55);
    expect(d04.currentState?.position).toEqual({ x: 10, y: 20, z: 30 });
    expect(d04.health?.status).toBe(RobotHealthStatus.WARNING);
    const h17 = snapshot.robots.find((r) => r.id === 'H-17')!;
    expect(h17.currentState).toBeNull();
    expect(h17.health).toBeNull();
  });

  it('lists alerts with filters and deterministic tied-timestamp cursor', async () => {
    const t = new Date('2026-08-14T20:00:01.000Z');
    await prisma.alert.createMany({
      data: [
        {
          id: 'alrt_a',
          robotId: 'D-04',
          type: AlertType.LOW_BATTERY,
          severity: AlertSeverity.WARNING,
          status: AlertStatus.OPEN,
          title: 'a',
          message: 'a',
          sourceTelemetryId: 's1',
          sourceEventId: 'e1',
          createdAt: new Date('2026-08-14T20:00:02.000Z'),
        },
        {
          id: 'alrt_c',
          robotId: 'D-04',
          type: AlertType.LOW_BATTERY,
          severity: AlertSeverity.WARNING,
          status: AlertStatus.OPEN,
          title: 'c',
          message: 'c',
          sourceTelemetryId: 's3',
          sourceEventId: 'e3',
          createdAt: t,
        },
        {
          id: 'alrt_b',
          robotId: 'H-17',
          type: AlertType.HIGH_TEMPERATURE,
          severity: AlertSeverity.CRITICAL,
          status: AlertStatus.OPEN,
          title: 'b',
          message: 'b',
          sourceTelemetryId: 's2',
          sourceEventId: 'e2',
          createdAt: t,
        },
      ],
    });

    const all = await alerts.list({ limit: 10 });
    expect(all.items.map((a) => a.id)).toEqual(['alrt_a', 'alrt_c', 'alrt_b']);

    const filtered = await alerts.list({
      limit: 10,
      robotId: 'D-04',
      severity: AlertSeverity.WARNING,
    });
    expect(filtered.items.map((a) => a.id)).toEqual(['alrt_a', 'alrt_c']);

    const page1 = await alerts.list({ limit: 1 });
    expect(page1.items[0]!.id).toBe('alrt_a');
    expect(page1.nextCursor).toBeTruthy();

    const page2 = await alerts.list({
      limit: 10,
      cursor: page1.nextCursor!,
    });
    expect(page2.items.map((a) => a.id)).toEqual(['alrt_c', 'alrt_b']);

    const afterTied = await alerts.list({
      limit: 10,
      cursor: { createdAt: t, alertId: 'alrt_c' },
    });
    expect(afterTied.items.map((a) => a.id)).toEqual(['alrt_b']);
  });
});
