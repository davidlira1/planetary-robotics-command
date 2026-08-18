import type { Channel } from 'amqplib';
import {
  DEAD_LETTER_EXCHANGE,
  RETRY_RETURN_EXCHANGE,
  TELEMETRY_EXCHANGE,
  deadLetterQueueName,
  retryQueueName,
  type TelemetryConsumerRole,
  workQueueName,
} from './topology';

export interface TopologyChannel {
  assertExchange: Channel['assertExchange'];
  assertQueue: Channel['assertQueue'];
  bindQueue: Channel['bindQueue'];
}

const ROLES: TelemetryConsumerRole[] = ['health', 'realtime'];

export async function assertTelemetryTopology(
  channel: TopologyChannel,
  retryTtlMs: number,
): Promise<void> {
  await channel.assertExchange(TELEMETRY_EXCHANGE, 'fanout', { durable: true });
  await channel.assertExchange(DEAD_LETTER_EXCHANGE, 'direct', { durable: true });
  await channel.assertExchange(RETRY_RETURN_EXCHANGE, 'direct', { durable: true });

  for (const role of ROLES) {
    const work = workQueueName(role);
    const retry = retryQueueName(role);
    const dlq = deadLetterQueueName(role);

    await channel.assertQueue(work, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': DEAD_LETTER_EXCHANGE,
        'x-dead-letter-routing-key': role,
      },
    });
    await channel.bindQueue(work, TELEMETRY_EXCHANGE, '');
    await channel.bindQueue(work, RETRY_RETURN_EXCHANGE, role);

    await channel.assertQueue(retry, {
      durable: true,
      arguments: {
        'x-message-ttl': retryTtlMs,
        'x-dead-letter-exchange': RETRY_RETURN_EXCHANGE,
        'x-dead-letter-routing-key': role,
      },
    });

    await channel.assertQueue(dlq, { durable: true });
    await channel.bindQueue(dlq, DEAD_LETTER_EXCHANGE, role);
  }
}
