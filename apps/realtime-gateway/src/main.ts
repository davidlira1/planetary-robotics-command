import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { AzureServiceBusTelemetryConsumer } from '@prc/messaging-asb';
import { Logger } from '@prc/ports';
import { handleRealtimeTelemetry } from './handle-realtime-telemetry';
import { WsRealtimeBroadcaster } from './ws-realtime-broadcaster';

loadEnv({ path: resolve(__dirname, '../../../.env') });

const logger: Logger = {
  info(message, fields) {
    console.log(JSON.stringify({ level: 'info', msg: message, ...fields }));
  },
  warn(message, fields) {
    console.warn(JSON.stringify({ level: 'warn', msg: message, ...fields }));
  },
  error(message, fields) {
    console.error(JSON.stringify({ level: 'error', msg: message, ...fields }));
  },
  debug(message, fields) {
    console.debug(JSON.stringify({ level: 'debug', msg: message, ...fields }));
  },
};

async function main() {
  const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING;
  const topic =
    process.env.SERVICE_BUS_TELEMETRY_TOPIC ?? 'robot.telemetry.received';
  const subscription =
    process.env.SERVICE_BUS_REALTIME_SUBSCRIPTION ?? 'realtime';
  const port = Number(process.env.REALTIME_GATEWAY_PORT ?? 3001);
  const path = process.env.REALTIME_GATEWAY_PATH ?? '/realtime';

  if (!connectionString) {
    throw new Error('SERVICE_BUS_CONNECTION_STRING is required');
  }

  const broadcaster = new WsRealtimeBroadcaster(logger, port, path);
  const consumer = new AzureServiceBusTelemetryConsumer({
    connectionString,
    topicName: topic,
    subscriptionName: subscription,
  });

  let stopping = false;
  const shutdown = async () => {
    if (stopping) {
      return;
    }
    stopping = true;
    logger.info('Realtime gateway shutting down', { operation: 'realtime-gateway' });
    await consumer.stop();
    await broadcaster.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  await consumer.start(async (body, message) => {
    const action = await handleRealtimeTelemetry(body, broadcaster, logger);
    if (action !== 'complete') {
      logger.warn('Realtime settlement', {
        operation: 'realtime-gateway',
        eventId: String(message.messageId ?? ''),
        correlationId: message.correlationId,
        action,
        deliveryCount: message.deliveryCount,
      });
    }
    return action;
  });

  logger.info('Realtime gateway started', {
    operation: 'realtime-gateway',
    topic,
    subscription,
    port,
    path,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
