import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import {
  createPrismaClient,
  PrismaOutboxRepository,
} from '@prc/persistence-prisma';
import { IntegrationEvent, Logger } from '@prc/ports';
import { createEventPublisher } from './create-publisher';

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

function toIntegrationEvent(payloadJson: string): IntegrationEvent {
  const envelope = JSON.parse(payloadJson) as {
    eventId: string;
    eventType: string;
    eventVersion: number;
    occurredAt: string;
    correlationId: string;
    causationId: string;
    payload: Record<string, unknown>;
  };
  return {
    eventId: envelope.eventId,
    eventType: envelope.eventType,
    eventVersion: envelope.eventVersion,
    occurredAt: new Date(envelope.occurredAt),
    correlationId: envelope.correlationId,
    causationId: envelope.causationId,
    payload: envelope.payload,
  };
}

async function main() {
  const pollMs = Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 500);
  const claimMs = Number(process.env.OUTBOX_CLAIM_DURATION_MS ?? 30_000);
  const batchSize = Number(process.env.OUTBOX_BATCH_SIZE ?? 20);

  const prisma = createPrismaClient();
  const outbox = new PrismaOutboxRepository(prisma);
  const publisher = createEventPublisher();

  let stopping = false;

  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    logger.info('Outbox publisher shutting down');
    await publisher.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  logger.info('Outbox publisher started', {
    operation: 'outbox-publisher',
    pollMs,
    provider: process.env.MESSAGE_BROKER_PROVIDER ?? 'azure-service-bus',
  });

  while (!stopping) {
    try {
      // Short claim transaction completes before any broker I/O.
      const claimed = await outbox.claimPending(batchSize, claimMs);
      for (const row of claimed) {
        if (stopping) break;
        try {
          const event = toIntegrationEvent(row.payloadJson);
          await publisher.publish(event);
          // Crash window: if we die here before markPublished, republish is expected.
          await outbox.markPublished(row.id, new Date());
          logger.info('Outbox message published', {
            operation: 'outbox-publisher',
            eventId: row.eventId,
            correlationId: row.correlationId,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await outbox.recordPublishFailure(row.id, message);
          logger.error('Outbox publish failed', {
            operation: 'outbox-publisher',
            eventId: row.eventId,
            correlationId: row.correlationId,
            errorCode: 'PUBLISH_FAILED',
          });
        }
      }
    } catch (err) {
      logger.error('Outbox claim loop error', {
        operation: 'outbox-publisher',
        errorCode: 'CLAIM_FAILED',
        err: err instanceof Error ? err.message : String(err),
      });
    }

    await new Promise((r) => setTimeout(r, pollMs));
  }
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
