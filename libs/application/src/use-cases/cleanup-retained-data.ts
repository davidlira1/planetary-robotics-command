import { DataRetentionRepository } from '@prc/ports';

export interface CleanupRetainedDataInput {
  now: Date;
  telemetryRetentionMs: number;
  publishedOutboxRetentionMs: number;
  processedMessageRetentionMs: number;
}

export interface CleanupRetainedDataResult {
  telemetryDeleted: number;
  outboxDeleted: number;
  processedMessagesDeleted: number;
}

export class CleanupRetainedData {
  constructor(private readonly retention: DataRetentionRepository) {}

  async execute(input: CleanupRetainedDataInput): Promise<CleanupRetainedDataResult> {
    const nowMs = input.now.getTime();
    const telemetryCutoff = new Date(nowMs - input.telemetryRetentionMs);
    const processedCutoff = new Date(nowMs - input.processedMessageRetentionMs);
    const outboxCutoff = new Date(nowMs - input.publishedOutboxRetentionMs);

    // Order is not required for correctness: these deletes are independent
    // (no FKs between the tables) and are not wrapped in one transaction.
    const telemetryDeleted = await this.retention.deleteTelemetryBefore(telemetryCutoff);
    const processedMessagesDeleted =
      await this.retention.deleteProcessedMessagesBefore(processedCutoff);
    const outboxDeleted = await this.retention.deletePublishedOutboxBefore(outboxCutoff);

    return {
      telemetryDeleted,
      outboxDeleted,
      processedMessagesDeleted,
    };
  }
}
