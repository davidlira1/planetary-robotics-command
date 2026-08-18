import { AzureServiceBusTelemetryConsumer } from '@prc/messaging-asb';
import { RabbitMqTelemetryConsumer } from '@prc/messaging-rabbitmq';
import type { TelemetryConsumer } from '@prc/ports';

export function createTelemetryConsumer(
  env: NodeJS.ProcessEnv = process.env,
): TelemetryConsumer {
  const provider = env.MESSAGE_BROKER_PROVIDER ?? 'azure-service-bus';
  if (provider === 'rabbitmq') {
    const url = env.RABBITMQ_URL;
    if (!url) {
      throw new Error('RABBITMQ_URL is required when MESSAGE_BROKER_PROVIDER=rabbitmq');
    }
    return new RabbitMqTelemetryConsumer({
      url,
      role: 'realtime',
      maxDeliveryCount: env.RABBITMQ_MAX_DELIVERY_COUNT
        ? Number(env.RABBITMQ_MAX_DELIVERY_COUNT)
        : undefined,
      retryTtlMs: env.RABBITMQ_RETRY_TTL_MS ? Number(env.RABBITMQ_RETRY_TTL_MS) : undefined,
    });
  }

  const connectionString = env.SERVICE_BUS_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error('SERVICE_BUS_CONNECTION_STRING is required');
  }
  return new AzureServiceBusTelemetryConsumer({
    connectionString,
    topicName: env.SERVICE_BUS_TELEMETRY_TOPIC ?? 'robot.telemetry.received',
    subscriptionName: env.SERVICE_BUS_REALTIME_SUBSCRIPTION ?? 'realtime',
  });
}
