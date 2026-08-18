export const TELEMETRY_EXCHANGE = 'robot.telemetry.received';
export const DEAD_LETTER_EXCHANGE = 'robot.telemetry.received.dlx';
export const RETRY_RETURN_EXCHANGE = 'robot.telemetry.received.retry';

export const DEFAULT_MAX_DELIVERY_COUNT = 10;
export const DEFAULT_RETRY_TTL_MS = 2000;
export const DEFAULT_PREFETCH = 10;

export const DELIVERY_COUNT_HEADER = 'x-prc-delivery-count';

export type TelemetryConsumerRole = 'health' | 'realtime';

export function workQueueName(role: TelemetryConsumerRole): string {
  return `${TELEMETRY_EXCHANGE}.${role}`;
}

export function retryQueueName(role: TelemetryConsumerRole): string {
  return `${workQueueName(role)}.retry`;
}

export function deadLetterQueueName(role: TelemetryConsumerRole): string {
  return `${workQueueName(role)}.dlq`;
}
