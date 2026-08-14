import { OutboxMessage } from './messaging-types';

export interface OutboxRepository {
  append(message: OutboxMessage): Promise<void>;
  /**
   * Short claim transaction only: select pending with FOR UPDATE SKIP LOCKED,
   * set claimedUntil, commit. Must not stay open across broker I/O.
   */
  claimPending(batchSize: number, claimDurationMs: number): Promise<OutboxMessage[]>;
  markPublished(outboxId: string, publishedAt: Date): Promise<void>;
  recordPublishFailure(outboxId: string, error: string): Promise<void>;
}
