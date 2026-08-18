import { loadRetentionConfig } from './config';

describe('loadRetentionConfig', () => {
  it('defaults to 2h telemetry, 2h published outbox, 24h processed, 10 minute interval', () => {
    const config = loadRetentionConfig({});
    expect(config.telemetryRetentionHours).toBe(2);
    expect(config.publishedOutboxRetentionHours).toBe(2);
    expect(config.processedMessageRetentionHours).toBe(24);
    expect(config.retentionIntervalMinutes).toBe(10);
    expect(config.telemetryRetentionMs).toBe(2 * 60 * 60 * 1000);
    expect(config.publishedOutboxRetentionMs).toBe(2 * 60 * 60 * 1000);
    expect(config.processedMessageRetentionMs).toBe(24 * 60 * 60 * 1000);
    expect(config.intervalMs).toBe(10 * 60 * 1000);
  });

  it('treats empty strings as defaults', () => {
    expect(
      loadRetentionConfig({ TELEMETRY_RETENTION_HOURS: '' }).telemetryRetentionHours,
    ).toBe(2);
  });

  it('rejects zero, negative, and non-integer retention values', () => {
    expect(() => loadRetentionConfig({ TELEMETRY_RETENTION_HOURS: '0' })).toThrow();
    expect(() =>
      loadRetentionConfig({ PUBLISHED_OUTBOX_RETENTION_HOURS: '-1' }),
    ).toThrow();
    expect(() =>
      loadRetentionConfig({ PROCESSED_MESSAGE_RETENTION_HOURS: '1.5' }),
    ).toThrow();
    expect(() => loadRetentionConfig({ RETENTION_INTERVAL_MINUTES: '0' })).toThrow();
  });
});
