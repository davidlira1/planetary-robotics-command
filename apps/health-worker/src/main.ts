import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { EvaluateRobotHealth } from '@prc/application';
import {
  createPrismaClient,
  PrismaUnitOfWork,
} from '@prc/persistence-prisma';
import { Logger, SettlementAction } from '@prc/ports';
import { ZodError } from 'zod';
import { createTelemetryConsumer } from './create-consumer';

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
  const prisma = createPrismaClient();
  const unitOfWork = new PrismaUnitOfWork(prisma);
  const evaluate = new EvaluateRobotHealth(unitOfWork, logger);
  const consumer = createTelemetryConsumer('health');

  const shutdown = async () => {
    logger.info('Health worker shutting down');
    await consumer.stop();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  await consumer.start(async (body, meta): Promise<SettlementAction> => {
    try {
      const result = await evaluate.execute(body);
      logger.info('Health message handled', {
        operation: 'health-worker',
        eventId: meta.messageId,
        correlationId: meta.correlationId,
        result: result.status,
        deliveryCount: meta.deliveryCount,
      });
      return 'complete';
    } catch (err) {
      if (isPermanent(err)) {
        logger.error('Permanent health message failure', {
          operation: 'health-worker',
          eventId: meta.messageId,
          correlationId: meta.correlationId,
          errorCode: 'PERMANENT',
          deliveryCount: meta.deliveryCount,
        });
        return 'deadLetter';
      }
      logger.error('Transient health message failure', {
        operation: 'health-worker',
        eventId: meta.messageId,
        correlationId: meta.correlationId,
        errorCode: 'TRANSIENT',
        deliveryCount: meta.deliveryCount,
        err: err instanceof Error ? err.message : String(err),
      });
      return 'abandon';
    }
  });

  logger.info('Health worker started', {
    operation: 'health-worker',
    provider: process.env.MESSAGE_BROKER_PROVIDER ?? 'azure-service-bus',
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
