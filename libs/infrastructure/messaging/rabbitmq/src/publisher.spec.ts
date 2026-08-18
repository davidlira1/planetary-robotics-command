import { buildPublishOptions } from './publisher';

describe('buildPublishOptions', () => {
  it('marks telemetry messages persistent', () => {
    const options = buildPublishOptions({
      eventId: 'evt_1',
      eventType: 'robot.telemetry.received',
      eventVersion: 1,
      occurredAt: new Date('2026-08-17T18:00:00.000Z'),
      correlationId: 'corr_1',
      causationId: 'cause_1',
      payload: {},
    });
    expect(options.persistent).toBe(true);
    expect(options.messageId).toBe('evt_1');
  });
});
