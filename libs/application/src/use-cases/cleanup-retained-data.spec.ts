import { DataRetentionRepository } from '@prc/ports';
import { CleanupRetainedData } from './cleanup-retained-data';

const NOW = new Date('2026-08-17T18:00:00.000Z');
const HOUR_MS = 60 * 60 * 1000;

class FakeRetention implements DataRetentionRepository {
  readonly calls: string[] = [];
  readonly telemetryCutoffs: Date[] = [];
  readonly processedCutoffs: Date[] = [];
  readonly outboxCutoffs: Date[] = [];

  async deleteTelemetryBefore(cutoff: Date): Promise<number> {
    this.calls.push('deleteTelemetryBefore');
    this.telemetryCutoffs.push(cutoff);
    return 3;
  }

  async deleteProcessedMessagesBefore(cutoff: Date): Promise<number> {
    this.calls.push('deleteProcessedMessagesBefore');
    this.processedCutoffs.push(cutoff);
    return 2;
  }

  async deletePublishedOutboxBefore(cutoff: Date): Promise<number> {
    this.calls.push('deletePublishedOutboxBefore');
    this.outboxCutoffs.push(cutoff);
    return 1;
  }
}

describe('CleanupRetainedData', () => {
  it('derives cutoffs from a single now and calls the published-outbox delete only', async () => {
    const retention = new FakeRetention();
    const cleanup = new CleanupRetainedData(retention);

    const result = await cleanup.execute({
      now: NOW,
      telemetryRetentionMs: 2 * HOUR_MS,
      publishedOutboxRetentionMs: 2 * HOUR_MS,
      processedMessageRetentionMs: 24 * HOUR_MS,
    });

    expect(retention.telemetryCutoffs).toEqual([new Date('2026-08-17T16:00:00.000Z')]);
    expect(retention.outboxCutoffs).toEqual([new Date('2026-08-17T16:00:00.000Z')]);
    expect(retention.processedCutoffs).toEqual([new Date('2026-08-16T18:00:00.000Z')]);
    expect(retention.calls).toEqual([
      'deleteTelemetryBefore',
      'deleteProcessedMessagesBefore',
      'deletePublishedOutboxBefore',
    ]);
    expect(retention.calls.filter((name) => name.toLowerCase().includes('outbox'))).toEqual([
      'deletePublishedOutboxBefore',
    ]);
    expect(result).toEqual({
      telemetryDeleted: 3,
      outboxDeleted: 1,
      processedMessagesDeleted: 2,
    });
  });

  it('applies independently configurable retention windows', async () => {
    const retention = new FakeRetention();
    const cleanup = new CleanupRetainedData(retention);

    await cleanup.execute({
      now: NOW,
      telemetryRetentionMs: 4 * HOUR_MS,
      publishedOutboxRetentionMs: 1 * HOUR_MS,
      processedMessageRetentionMs: 48 * HOUR_MS,
    });

    expect(retention.telemetryCutoffs[0]).toEqual(new Date('2026-08-17T14:00:00.000Z'));
    expect(retention.outboxCutoffs[0]).toEqual(new Date('2026-08-17T17:00:00.000Z'));
    expect(retention.processedCutoffs[0]).toEqual(new Date('2026-08-15T18:00:00.000Z'));
  });
});
