import { AzureServiceBusEventPublisher } from '@prc/messaging-asb';
import { RabbitMqEventPublisher } from '@prc/messaging-rabbitmq';
import type { EventPublisher } from '@prc/ports';

export function createEventPublisher(env: NodeJS.ProcessEnv = process.env): EventPublisher {
  const provider = env.MESSAGE_BROKER_PROVIDER ?? 'azure-service-bus';
  if (provider === 'rabbitmq') {
    const url = env.RABBITMQ_URL;
    if (!url) {
      throw new Error('RABBITMQ_URL is required when MESSAGE_BROKER_PROVIDER=rabbitmq');
    }
    return new RabbitMqEventPublisher({
      url,
      exchange: env.RABBITMQ_EXCHANGE ?? 'robot.telemetry.received',
      retryTtlMs: env.RABBITMQ_RETRY_TTL_MS ? Number(env.RABBITMQ_RETRY_TTL_MS) : undefined,
    });
  }

  const connectionString = env.SERVICE_BUS_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error('SERVICE_BUS_CONNECTION_STRING is required');
  }
  return new AzureServiceBusEventPublisher({
    connectionString,
    topicName: env.SERVICE_BUS_TELEMETRY_TOPIC ?? 'robot.telemetry.received',
  });
}
