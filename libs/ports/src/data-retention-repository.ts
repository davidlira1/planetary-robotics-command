export interface DataRetentionRepository {
  deleteTelemetryBefore(cutoff: Date): Promise<number>;
  deletePublishedOutboxBefore(cutoff: Date): Promise<number>;
  deleteProcessedMessagesBefore(cutoff: Date): Promise<number>;
}
