export type SettlementAction = 'complete' | 'abandon' | 'deadLetter';

export interface ReceivedMessageMeta {
  messageId: string;
  correlationId?: string;
  deliveryCount: number;
}

export type TelemetryMessageHandler = (
  body: unknown,
  meta: ReceivedMessageMeta,
) => Promise<SettlementAction>;

export interface TelemetryConsumer {
  start(handler: TelemetryMessageHandler): Promise<void>;
  stop(): Promise<void>;
}
