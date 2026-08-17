import type { Logger } from '@prc/ports';
import { handleRealtimeTelemetry } from './handle-realtime-telemetry';
import type { RealtimeBroadcaster } from './realtime-broadcaster';

const logger: Logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

function validEvent(eventId = 'evt_1') {
  return {
    eventId,
    eventType: 'robot.telemetry.received',
    eventVersion: 1,
    occurredAt: '2026-08-13T20:00:03.100Z',
    correlationId: 'req_1',
    causationId: 'tel_1',
    payload: {
      robotId: 'D-04',
      telemetryId: 'tel_1',
      sourceTelemetryId: 'src_1',
      telemetrySchemaVersion: 1,
      recordedAt: '2026-08-13T20:00:03.000Z',
      receivedAt: '2026-08-13T20:00:03.100Z',
      position: { x: 1, y: 2, z: 3 },
      batteryPercent: 80,
      temperatureCelsius: 40,
      signalStrengthDbm: -70,
      velocityMetersPerSecond: 1,
      headingDegrees: 10,
    },
  };
}

function broadcaster(impl: Partial<RealtimeBroadcaster> = {}): RealtimeBroadcaster {
  return {
    publish: impl.publish ?? jest.fn().mockResolvedValue(undefined),
    clientCount: impl.clientCount ?? (() => 1),
    close: impl.close ?? jest.fn().mockResolvedValue(undefined),
  };
}

describe('handleRealtimeTelemetry', () => {
  it('broadcasts a valid event once and completes', async () => {
    const publish = jest.fn().mockResolvedValue(undefined);
    const action = await handleRealtimeTelemetry(validEvent(), broadcaster({ publish }), logger);
    expect(action).toBe('complete');
    expect(publish).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(publish.mock.calls[0][0] as string);
    expect(payload.eventId).toBe('evt_1');
    expect(payload.type).toBe('robot.state.updated');
    expect(payload.robot.id).toBe('D-04');
  });

  it('dead-letters invalid internal events without broadcasting', async () => {
    const publish = jest.fn();
    const action = await handleRealtimeTelemetry({ nope: true }, broadcaster({ publish }), logger);
    expect(action).toBe('deadLetter');
    expect(publish).not.toHaveBeenCalled();
  });

  it('emits the same public eventId for a duplicate delivery', async () => {
    const publish = jest.fn().mockResolvedValue(undefined);
    const source = broadcaster({ publish });
    await handleRealtimeTelemetry(validEvent('evt_dup'), source, logger);
    await handleRealtimeTelemetry(validEvent('evt_dup'), source, logger);
    expect(publish).toHaveBeenCalledTimes(2);
    expect(JSON.parse(publish.mock.calls[0][0] as string).eventId).toBe('evt_dup');
    expect(JSON.parse(publish.mock.calls[1][0] as string).eventId).toBe('evt_dup');
  });

  it('abandons when the broadcaster itself fails', async () => {
    const publish = jest.fn().mockRejectedValue(new Error('gateway down'));
    const action = await handleRealtimeTelemetry(validEvent(), broadcaster({ publish }), logger);
    expect(action).toBe('abandon');
  });
});
