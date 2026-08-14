import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { EvaluateRobotHealth } from '@prc/application';
import {
  AzureServiceBusTelemetryConsumer,
  SettlementAction,
} from '@prc/messaging-asb';
import {
  createPrismaClient,
  PrismaUnitOfWork,
} from '@prc/persistence-prisma';
import { Logger } from '@prc/ports';
import { ZodError } from 'zod';

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

function isPermanent(err: unknown): boolean {
  return err instanceof ZodError || err instanceof SyntaxError;
}

async function main() {
  const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING;
  const topic =
    process.env.SERVICE_BUS_TELEMETRY_TOPIC ?? 'robot.telemetry.received';
  const subscription =
    process.env.SERVICE_BUS_HEALTH_SUBSCRIPTION ?? 'health';

  if (!connectionString) {
    throw new Error('SERVICE_BUS_CONNECTION_STRING is required');
  }

  const prisma = createPrismaClient();
  const unitOfWork = new PrismaUnitOfWork(prisma);
  const evaluate = new EvaluateRobotHealth(unitOfWork, logger);
  const consumer = new AzureServiceBusTelemetryConsumer({
    connectionString,
    topicName: topic,
    subscriptionName: subscription,
  });

  const shutdown = async () => {
    logger.info('Health worker shutting down');
    await consumer.stop();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  await consumer.start(async (body, message): Promise<SettlementAction> => {
    try {
      const result = await evaluate.execute(body);
      logger.info('Health message handled', {
        operation: 'health-worker',
        eventId: String(message.messageId ?? ''),
        correlationId: message.correlationId,
        result: result.status,
        deliveryCount: message.deliveryCount,
      });
      return 'complete';
    } catch (err) {
      if (isPermanent(err)) {
        logger.error('Permanent health message failure', {
          operation: 'health-worker',
          eventId: String(message.messageId ?? ''),
          correlationId: message.correlationId,
          errorCode: 'PERMANENT',
          deliveryCount: message.deliveryCount,
        });
        return 'deadLetter';
      }
      logger.error('Transient health message failure', {
        operation: 'health-worker',
        eventId: String(message.messageId ?? ''),
        correlationId: message.correlationId,
        errorCode: 'TRANSIENT',
        deliveryCount: message.deliveryCount,
        err: err instanceof Error ? err.message : String(err),
      });
      return 'abandon';
    }
  });

  logger.info('Health worker started', {
    operation: 'health-worker',
    topic,
    subscription,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
