import type { ConsumeMessage } from 'amqplib';
import type { SettlementAction } from '@prc/ports';
import { DELIVERY_COUNT_HEADER } from './topology';

export type SettlePlan =
  | { kind: 'ack' }
  | { kind: 'deadLetter' }
  | { kind: 'retry'; nextDeliveryCount: number };

export interface SettlementChannel {
  ack(message: ConsumeMessage): void;
  nack(message: ConsumeMessage, allUpTo: boolean, requeue: boolean): void;
  sendToQueue(
    queue: string,
    content: Buffer,
    options?: {
      persistent?: boolean;
      contentType?: string;
      messageId?: string;
      correlationId?: string;
      headers?: Record<string, unknown>;
    },
  ): boolean;
}

export function readDeliveryCount(headers: Record<string, unknown> | undefined): number {
  const raw = headers?.[DELIVERY_COUNT_HEADER];
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function planSettlement(
  action: SettlementAction,
  deliveryCount: number,
  maxDeliveryCount: number,
): SettlePlan {
  if (action === 'complete') {
    return { kind: 'ack' };
  }
  if (action === 'deadLetter' || deliveryCount >= maxDeliveryCount) {
    return { kind: 'deadLetter' };
  }
  return { kind: 'retry', nextDeliveryCount: deliveryCount + 1 };
}

export function applySettlement(
  channel: SettlementChannel,
  message: ConsumeMessage,
  plan: SettlePlan,
  retryQueue: string,
): void {
  if (plan.kind === 'ack') {
    channel.ack(message);
    return;
  }
  if (plan.kind === 'deadLetter') {
    channel.nack(message, false, false);
    return;
  }

  const headers = (message.properties.headers ?? {}) as Record<string, unknown>;
  channel.sendToQueue(retryQueue, message.content, {
    persistent: true,
    contentType: message.properties.contentType ?? 'application/json',
    messageId: message.properties.messageId,
    correlationId: message.properties.correlationId,
    headers: {
      ...headers,
      [DELIVERY_COUNT_HEADER]: plan.nextDeliveryCount,
    },
  });
  channel.ack(message);
}
