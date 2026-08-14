/** Messaging/reliability types for ports — not core robot domain. */

export interface OutboxMessage {
  id: string;
  eventId: string;
  eventType: string;
  eventVersion: number;
  occurredAt: Date;
  correlationId: string;
  causationId: string;
  /** Exact envelope JSON intended for broker publication. */
  payloadJson: string;
  createdAt: Date;
  publishedAt: Date | null;
  publishAttempts: number;
  lastPublishError: string | null;
  claimedUntil: Date | null;
}

export interface ProcessedMessage {
  consumer: string;
  eventId: string;
  processedAt: Date;
}

export interface IntegrationEvent {
  eventId: string;
  eventType: string;
  eventVersion: number;
  occurredAt: Date;
  correlationId: string;
  causationId: string;
  payload: Record<string, unknown>;
}
