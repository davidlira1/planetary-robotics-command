import type { Options } from 'amqplib';
import type { Channel, ChannelModel } from 'amqplib';
import { connect } from 'amqplib';
import { EventPublisher, IntegrationEvent } from '@prc/ports';
import { assertTelemetryTopology } from './assert-topology';
import { DEFAULT_RETRY_TTL_MS, TELEMETRY_EXCHANGE } from './topology';

export interface RabbitMqPublisherConfig {
  url: string;
  exchange?: string;
  retryTtlMs?: number;
}

export function buildPublishOptions(event: IntegrationEvent): Options.Publish {
  return {
    persistent: true,
    contentType: 'application/json',
    messageId: event.eventId,
    correlationId: event.correlationId,
    headers: {
      eventType: event.eventType,
      eventVersion: event.eventVersion,
    },
  };
}

export function serializeIntegrationEvent(event: IntegrationEvent): Buffer {
  return Buffer.from(
    JSON.stringify({
      eventId: event.eventId,
      eventType: event.eventType,
      eventVersion: event.eventVersion,
      occurredAt: event.occurredAt.toISOString(),
      correlationId: event.correlationId,
      causationId: event.causationId,
      payload: event.payload,
    }),
  );
}

export class RabbitMqEventPublisher implements EventPublisher {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(private readonly config: RabbitMqPublisherConfig) {}

  async publish(event: IntegrationEvent): Promise<void> {
    const channel = await this.ensureChannel();
    const body = serializeIntegrationEvent(event);
    const ok = channel.publish(
      this.config.exchange ?? TELEMETRY_EXCHANGE,
      '',
      body,
      buildPublishOptions(event),
    );
    if (!ok) {
      throw new Error('RabbitMQ publish buffer full');
    }
  }

  async close(): Promise<void> {
    await this.channel?.close();
    this.channel = null;
    await this.connection?.close();
    this.connection = null;
  }

  private async ensureChannel(): Promise<Channel> {
    if (this.channel) {
      return this.channel;
    }
    this.connection = await connect(this.config.url);
    this.channel = await this.connection.createChannel();
    await assertTelemetryTopology(this.channel, this.config.retryTtlMs ?? DEFAULT_RETRY_TTL_MS);
    return this.channel;
  }
}
