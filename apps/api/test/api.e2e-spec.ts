import { INestApplication, RequestMethod } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { seedRobots } from '@prc/persistence-prisma';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/filters/api-exception.filter';
import { RequestIdMiddleware } from '../src/middleware/request-id.middleware';
import { PrismaService } from '../src/persistence/prisma.service';

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
  let prisma: PrismaService;

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

    prisma = app.get(PrismaService);
    await prisma.robotTelemetry.deleteMany();
    await prisma.robotCurrentState.deleteMany();
    await seedRobots(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
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
      'H-17',
      'M-12',
      'S-03',
      'W-08',
    ]);
    expect(res.body.page.limit).toBe(50);
  });

  it('GET /robots/:id returns detail', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/telemetry')
      .send(telemetryPayload())
      .expect(202);
    const res = await request(app.getHttpServer())
      .get('/api/v1/robots/D-04')
      .expect(200);
    expect(res.body.id).toBe('D-04');
    expect(res.body.currentState.batteryPercent).toBe(82.4);
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
