import { INestApplication, RequestMethod } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { createPrismaClient, seedRobots } from '@prc/persistence-prisma';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/filters/api-exception.filter';
import { RequestIdMiddleware } from '../src/middleware/request-id.middleware';

function telemetryPayload(overrides: Record<string, unknown> = {}) {
  return {
    sourceTelemetryId: 'D04-E2E-1',
    robotId: 'D-04',
    schemaVersion: 1,
    recordedAt: '2026-08-13T20:00:03.000Z',
    position: { x: 140.2, y: 11.8, z: 72.4 },
    batteryPercent: 82.4,
    temperatureCelsius: 58.1,
    signalStrengthDbm: -71,
    velocityMetersPerSecond: 4.7,
    headingDegrees: 218,
    ...overrides,
  };
}

describe('API e2e', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new ApiExceptionFilter());
    app.setGlobalPrefix('api/v1', {
      exclude: [
        { path: 'health/live', method: RequestMethod.GET },
        { path: 'health/ready', method: RequestMethod.GET },
      ],
    });
    const requestId = new RequestIdMiddleware();
    app.use((req: unknown, res: unknown, next: () => void) =>
      requestId.use(req as never, res as never, next),
    );
    await app.init();

    prisma = createPrismaClient();
    await prisma.robotTelemetry.deleteMany();
    await prisma.robotCurrentState.deleteMany();
    await seedRobots(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    await prisma.alert.deleteMany();
    await prisma.processedMessage.deleteMany();
    await prisma.outboxMessage.deleteMany();
    await prisma.robotHealthState.deleteMany();
    await prisma.robotTelemetry.deleteMany();
    await prisma.robotCurrentState.deleteMany();
  });

  it('GET /health/live returns ok', async () => {
    await request(app.getHttpServer())
      .get('/health/live')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('GET /health/ready returns ok when DB is up', async () => {
    await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('POST telemetry valid -> 202 and updates current state', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/telemetry')
      .send(telemetryPayload())
      .expect(202);

    expect(res.body.status).toBe('ACCEPTED');
    expect(res.body.telemetryId).toMatch(/^tel_/);
    expect(res.headers['x-request-id']).toBeDefined();

    const state = await prisma.robotCurrentState.findUnique({
      where: { robotId: 'D-04' },
    });
    expect(state?.batteryPercent).toBe(82.4);
    expect(await prisma.robotTelemetry.count()).toBe(1);
  });

  it('POST telemetry missing robotId -> 400 VALIDATION_ERROR', async () => {
    const { robotId: _, ...body } = telemetryPayload();
    const res = await request(app.getHttpServer())
      .post('/api/v1/telemetry')
      .send(body)
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST telemetry invalid battery -> 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/telemetry')
      .send(telemetryPayload({ batteryPercent: 120 }))
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST telemetry invalid heading -> 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/telemetry')
      .send(telemetryPayload({ headingDegrees: 360 }))
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST telemetry malformed recordedAt -> 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/telemetry')
      .send(telemetryPayload({ recordedAt: 'not-a-date' }))
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST telemetry unsupported schemaVersion -> 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/telemetry')
      .send(telemetryPayload({ schemaVersion: 2 }))
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST telemetry unknown robot -> 404 ROBOT_NOT_FOUND', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/telemetry')
      .send(telemetryPayload({ robotId: 'D-99', sourceTelemetryId: 'x' }))
      .expect(404);
    expect(res.body.error.code).toBe('ROBOT_NOT_FOUND');
  });

  it('idempotent same payload -> 202 same telemetryId', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/v1/telemetry')
      .send(telemetryPayload())
      .expect(202);
    const second = await request(app.getHttpServer())
      .post('/api/v1/telemetry')
      .send(telemetryPayload())
      .expect(202);
    expect(second.body.telemetryId).toBe(first.body.telemetryId);
    expect(await prisma.robotTelemetry.count()).toBe(1);
  });

  it('conflicting idempotency key -> 409 IDEMPOTENCY_CONFLICT', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/telemetry')
      .send(telemetryPayload())
      .expect(202);
    const res = await request(app.getHttpServer())
      .post('/api/v1/telemetry')
      .send(telemetryPayload({ batteryPercent: 10 }))
      .expect(409);
    expect(res.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('older telemetry does not regress current state', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/telemetry')
      .send(telemetryPayload())
      .expect(202);
    await request(app.getHttpServer())
      .post('/api/v1/telemetry')
      .send(
        telemetryPayload({
          sourceTelemetryId: 'D04-E2E-older',
          recordedAt: '2026-08-13T20:00:02.000Z',
          batteryPercent: 10,
        }),
      )
      .expect(202);

    const state = await prisma.robotCurrentState.findUnique({
      where: { robotId: 'D-04' },
    });
    expect(state?.batteryPercent).toBe(82.4);
    expect(await prisma.robotTelemetry.count()).toBe(2);
  });

  it('equal recordedAt keeps existing current state', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/telemetry')
      .send(telemetryPayload({ batteryPercent: 82.4 }))
      .expect(202);
    await request(app.getHttpServer())
      .post('/api/v1/telemetry')
      .send(
        telemetryPayload({
          sourceTelemetryId: 'D04-E2E-tie',
          batteryPercent: 10,
        }),
      )
      .expect(202);
    const state = await prisma.robotCurrentState.findUnique({
      where: { robotId: 'D-04' },
    });
    expect(state?.batteryPercent).toBe(82.4);
  });

  it('concurrent telemetry settles on newest recordedAt', async () => {
    const payloads = [
      telemetryPayload({
        sourceTelemetryId: 'D04-CONC-1',
        recordedAt: '2026-08-13T20:00:01.000Z',
        batteryPercent: 40,
      }),
      telemetryPayload({
        sourceTelemetryId: 'D04-CONC-2',
        recordedAt: '2026-08-13T20:00:05.000Z',
        batteryPercent: 90,
      }),
    ];

    await Promise.all(
      payloads.map((p) =>
        request(app.getHttpServer()).post('/api/v1/telemetry').send(p).expect(202),
      ),
    );

    const state = await prisma.robotCurrentState.findUnique({
      where: { robotId: 'D-04' },
    });
    expect(state?.batteryPercent).toBe(90);
    expect(state?.recordedAt.toISOString()).toBe('2026-08-13T20:00:05.000Z');
    expect(await prisma.robotTelemetry.count()).toBe(2);
  });

  it('GET /robots returns seeded fleet ordered by id', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/robots')
      .expect(200);
    expect(res.body.items.map((i: { id: string }) => i.id)).toEqual([
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
    expect(res.body.page.limit).toBe(50);
  });

  it('GET /robots/:id returns detail with null health when unevaluated', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/telemetry')
      .send(telemetryPayload())
      .expect(202);
    const res = await request(app.getHttpServer())
      .get('/api/v1/robots/D-04')
      .expect(200);
    expect(res.body.id).toBe('D-04');
    expect(res.body.currentState.batteryPercent).toBe(82.4);
    expect(res.body.health).toBeNull();
  });

  it('GET /fleet returns ten seeded robots with nullable state/health', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/fleet')
      .expect(200);
    expect(res.body.robots.map((r: { id: string }) => r.id)).toEqual([
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
    expect(res.body.robots.every((r: { health: unknown }) => r.health === null)).toBe(
      true,
    );

    await request(app.getHttpServer())
      .post('/api/v1/telemetry')
      .send(telemetryPayload())
      .expect(202);
    await prisma.robotHealthState.create({
      data: {
        robotId: 'D-04',
        status: 'HEALTHY',
        batteryStatus: 'NORMAL',
        temperatureStatus: 'NORMAL',
        signalStatus: 'NORMAL',
        evaluatedFromTelemetryId: 'tel_e2e',
        evaluatedFromRecordedAt: new Date('2026-08-13T20:00:03.000Z'),
        updatedAt: new Date('2026-08-13T20:00:04.000Z'),
      },
    });

    const fleet = await request(app.getHttpServer())
      .get('/api/v1/fleet')
      .expect(200);
    const d04 = fleet.body.robots.find((r: { id: string }) => r.id === 'D-04');
    expect(d04.currentState.batteryPercent).toBe(82.4);
    expect(d04.health.status).toBe('HEALTHY');
  });

  it('GET /alerts supports filters, cursor, and validation', async () => {
    await prisma.alert.createMany({
      data: [
        {
          id: 'alrt_e2e_1',
          robotId: 'D-04',
          type: 'LOW_BATTERY',
          severity: 'WARNING',
          status: 'OPEN',
          title: 't1',
          message: 'm1',
          sourceTelemetryId: 's1',
          sourceEventId: 'e1',
          createdAt: new Date('2026-08-14T20:00:02.000Z'),
        },
        {
          id: 'alrt_e2e_2',
          robotId: 'H-17',
          type: 'HIGH_TEMPERATURE',
          severity: 'CRITICAL',
          status: 'OPEN',
          title: 't2',
          message: 'm2',
          sourceTelemetryId: 's2',
          sourceEventId: 'e2',
          createdAt: new Date('2026-08-14T20:00:01.000Z'),
        },
      ],
    });

    const all = await request(app.getHttpServer())
      .get('/api/v1/alerts')
      .expect(200);
    expect(all.body.items.map((a: { id: string }) => a.id)).toEqual([
      'alrt_e2e_1',
      'alrt_e2e_2',
    ]);

    const filtered = await request(app.getHttpServer())
      .get('/api/v1/alerts?robotId=D-04&severity=WARNING&status=OPEN')
      .expect(200);
    expect(filtered.body.items).toHaveLength(1);
    expect(filtered.body.items[0].id).toBe('alrt_e2e_1');

    const page = await request(app.getHttpServer())
      .get('/api/v1/alerts?limit=1')
      .expect(200);
    expect(page.body.items).toHaveLength(1);
    expect(page.body.page.nextCursor).toBeTruthy();

    const page2 = await request(app.getHttpServer())
      .get(`/api/v1/alerts?limit=1&cursor=${encodeURIComponent(page.body.page.nextCursor)}`)
      .expect(200);
    expect(page2.body.items[0].id).toBe('alrt_e2e_2');

    await request(app.getHttpServer())
      .get('/api/v1/alerts?limit=0')
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/alerts?severity=LOUD')
      .expect(400);
  });

  it('GET telemetry history supports order and max limit', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/telemetry')
      .send(telemetryPayload({ sourceTelemetryId: 'h1', recordedAt: '2026-08-13T19:00:00.000Z' }))
      .expect(202);
    await request(app.getHttpServer())
      .post('/api/v1/telemetry')
      .send(telemetryPayload({ sourceTelemetryId: 'h2', recordedAt: '2026-08-13T20:00:00.000Z' }))
      .expect(202);

    const res = await request(app.getHttpServer())
      .get('/api/v1/robots/D-04/telemetry?order=desc&limit=1')
      .expect(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].sourceTelemetryId).toBe('h2');
    expect(res.body.items[0].schemaVersion).toBe(1);
    expect(res.body.page.nextCursor).toBeTruthy();

    await request(app.getHttpServer())
      .get('/api/v1/robots/D-04/telemetry?limit=501')
      .expect(400);
  });
});
