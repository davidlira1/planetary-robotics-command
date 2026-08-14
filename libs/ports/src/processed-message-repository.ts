export type BeginProcessingResult =
  | { acquired: true }
  | { acquired: false; reason: 'duplicate' };

/**
 * Inbox ownership. Unique (consumer, eventId) is the final authority.
 * tryBeginProcessing inserts the processed marker; conflict means duplicate.
 */
export interface ProcessedMessageRepository {
  tryBeginProcessing(consumer: string, eventId: string): Promise<BeginProcessingResult>;
}
