import { TelemetrySample } from '@prc/ports';
import { HttpTelemetryProducer, mapSampleToRequest } from './producer';

const silentLogger = {
  info() {},
  warn() {},
  error() {},
  debug() {},
};

function sample(overrides: Partial<TelemetrySample> = {}): TelemetrySample {
  return Object.freeze({
    sourceTelemetryId: 'sim_D04_ABC',
    robotId: 'D-04',
    schemaVersion: 1,
    recordedAt: new Date('2026-08-14T20:00:00.000Z'),
    position: Object.freeze({ x: 1, y: 2, z: 3 }),
    batteryPercent: 80,
    temperatureCelsius: 40,
    signalStrengthDbm: -70,
    velocityMetersPerSecond: 1,
    headingDegrees: 10,
    ...overrides,
  });
}

describe('mapSampleToRequest', () => {
  it('converts Date recordedAt to ISO-8601', () => {
    const req = mapSampleToRequest(sample());
    expect(req.recordedAt).toBe('2026-08-14T20:00:00.000Z');
    expect(req.sourceTelemetryId).toBe('sim_D04_ABC');
  });
});

describe('HttpTelemetryProducer', () => {
  it('returns accepted on 202', async () => {
    const fetchImpl = jest.fn(async () =>
      new Response(
        JSON.stringify({
          telemetryId: 'tel_1',
          robotId: 'D-04',
          recordedAt: '2026-08-14T20:00:00.000Z',
          receivedAt: '2026-08-14T20:00:00.100Z',
          status: 'ACCEPTED',
        }),
        { status: 202, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const producer = new HttpTelemetryProducer(
      { baseUrl: 'http://localhost:3000', fetchImpl, sleep: async () => {} },
      silentLogger,
    );

    const result = await producer.send(sample());
    expect(result).toEqual({ status: 'accepted', telemetryId: 'tel_1' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries network failures and reuses the same payload', async () => {
    const bodies: string[] = [];
    let calls = 0;
    const fetchImpl = jest.fn(async (_url: unknown, init?: RequestInit) => {
      bodies.push(String(init?.body));
      calls += 1;
      if (calls < 3) throw new Error('ECONNRESET');
      return new Response(
        JSON.stringify({
          telemetryId: 'tel_2',
          robotId: 'D-04',
          recordedAt: '2026-08-14T20:00:00.000Z',
          receivedAt: '2026-08-14T20:00:00.100Z',
          status: 'ACCEPTED',
        }),
        { status: 202 },
      );
    });

    const producer = new HttpTelemetryProducer(
      {
        baseUrl: 'http://localhost:3000',
        fetchImpl: fetchImpl as typeof fetch,
        sleep: async () => {},
        maxAttempts: 5,
      },
      silentLogger,
    );

    const result = await producer.send(sample());
    expect(result.status).toBe('accepted');
    expect(bodies).toHaveLength(3);
    expect(bodies[0]).toBe(bodies[1]);
    expect(bodies[1]).toBe(bodies[2]);
    const parsed = JSON.parse(bodies[0]!);
    expect(parsed.sourceTelemetryId).toBe('sim_D04_ABC');
    expect(parsed.recordedAt).toBe('2026-08-14T20:00:00.000Z');
  });

  it('retries 500 responses', async () => {
    let calls = 0;
    const fetchImpl = jest.fn(async () => {
      calls += 1;
      if (calls < 2) return new Response('fail', { status: 500 });
      return new Response(
        JSON.stringify({
          telemetryId: 'tel_3',
          robotId: 'D-04',
          recordedAt: '2026-08-14T20:00:00.000Z',
          receivedAt: '2026-08-14T20:00:00.100Z',
          status: 'ACCEPTED',
        }),
        { status: 202 },
      );
    });

    const producer = new HttpTelemetryProducer(
      { baseUrl: 'http://localhost:3000', fetchImpl, sleep: async () => {}, maxAttempts: 3 },
      silentLogger,
    );

    const result = await producer.send(sample());
    expect(result.status).toBe('accepted');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('treats 400 as permanent', async () => {
    const fetchImpl = jest.fn(
      async () => new Response('bad', { status: 400 }),
    );
    const producer = new HttpTelemetryProducer(
      { baseUrl: 'http://localhost:3000', fetchImpl, sleep: async () => {}, maxAttempts: 5 },
      silentLogger,
    );
    const result = await producer.send(sample());
    expect(result).toMatchObject({
      status: 'permanent_error',
      kind: 'validation',
      statusCode: 400,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('treats 404 as permanent', async () => {
    const fetchImpl = jest.fn(
      async () => new Response('missing', { status: 404 }),
    );
    const producer = new HttpTelemetryProducer(
      { baseUrl: 'http://localhost:3000', fetchImpl, sleep: async () => {} },
      silentLogger,
    );
    const result = await producer.send(sample());
    expect(result).toMatchObject({
      status: 'permanent_error',
      kind: 'not_found',
      statusCode: 404,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('surfaces 409 as idempotency conflict without endless retry', async () => {
    const fetchImpl = jest.fn(
      async () => new Response('conflict', { status: 409 }),
    );
    const producer = new HttpTelemetryProducer(
      { baseUrl: 'http://localhost:3000', fetchImpl, sleep: async () => {}, maxAttempts: 5 },
      silentLogger,
    );
    const result = await producer.send(sample());
    expect(result).toMatchObject({
      status: 'permanent_error',
      kind: 'idempotency_conflict',
      statusCode: 409,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('respects maximum retry policy', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new Error('down');
    });
    const producer = new HttpTelemetryProducer(
      { baseUrl: 'http://localhost:3000', fetchImpl, sleep: async () => {}, maxAttempts: 3 },
      silentLogger,
    );
    const result = await producer.send(sample());
    expect(result).toEqual({ status: 'exhausted', lastError: 'down' });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
