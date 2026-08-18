import type { Channel, ChannelModel, ConsumeMessage } from 'amqplib';
import { connect } from 'amqplib';
import type {
  TelemetryConsumer,
  TelemetryMessageHandler,
} from '@prc/ports';
import { assertTelemetryTopology } from './assert-topology';
import { applySettlement, planSettlement, readDeliveryCount } from './settlement';
import {
  DEFAULT_MAX_DELIVERY_COUNT,
  DEFAULT_PREFETCH,
  DEFAULT_RETRY_TTL_MS,
  retryQueueName,
  type TelemetryConsumerRole,
  workQueueName,
} from './topology';

export interface RabbitMqConsumerConfig {
  url: string;
  role: TelemetryConsumerRole;
  maxDeliveryCount?: number;
  retryTtlMs?: number;
  prefetch?: number;
}

export class RabbitMqTelemetryConsumer implements TelemetryConsumer {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private consumerTag: string | null = null;

  constructor(private readonly config: RabbitMqConsumerConfig) {}

  async start(handler: TelemetryMessageHandler): Promise<void> {
    const connection = await connect(this.config.url);
    const channel = await connection.createChannel();
    const retryTtlMs = this.config.retryTtlMs ?? DEFAULT_RETRY_TTL_MS;
    const maxDeliveryCount = this.config.maxDeliveryCount ?? DEFAULT_MAX_DELIVERY_COUNT;
    const prefetch = this.config.prefetch ?? DEFAULT_PREFETCH;
    await assertTelemetryTopology(channel, retryTtlMs);
    await channel.prefetch(prefetch);

    const queue = workQueueName(this.config.role);
    const retryQueue = retryQueueName(this.config.role);
    const { consumerTag } = await channel.consume(queue, async (message) => {
      if (!message) {
        return;
      }
      await this.settle(channel, message, handler, maxDeliveryCount, retryQueue);
    });

    this.connection = connection;
    this.channel = channel;
    this.consumerTag = consumerTag;
  }

  async stop(): Promise<void> {
    if (this.channel && this.consumerTag) {
      await this.channel.cancel(this.consumerTag);
    }
    this.consumerTag = null;
    await this.channel?.close();
    this.channel = null;
    await this.connection?.close();
    this.connection = null;
  }

  private async settle(
    channel: Channel,
    message: ConsumeMessage,
    handler: TelemetryMessageHandler,
    maxDeliveryCount: number,
    retryQueue: string,
  ): Promise<void> {
    const headers = (message.properties.headers ?? {}) as Record<string, unknown>;
    const deliveryCount = readDeliveryCount(headers);
    let body: unknown = message.content;
    try {
      body = JSON.parse(message.content.toString());
    } catch {
      channel.nack(message, false, false);
      return;
    }

    let action;
    try {
      action = await handler(body, {
        messageId: String(message.properties.messageId ?? ''),
        correlationId:
          message.properties.correlationId != null
            ? String(message.properties.correlationId)
            : undefined,
        deliveryCount,
      });
    } catch {
      action = 'abandon' as const;
    }

    applySettlement(
      channel,
      message,
      planSettlement(action, deliveryCount, maxDeliveryCount),
      retryQueue,
    );
  }
}
