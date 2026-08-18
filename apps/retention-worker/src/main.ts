import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { CleanupRetainedData } from '@prc/application';
import {
  createPrismaClient,
  PrismaDataRetentionRepository,
} from '@prc/persistence-prisma';
import { Logger } from '@prc/ports';
import { loadRetentionConfig } from './config';

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

function delay(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

async function main() {
  const env = loadRetentionConfig();
  const prisma = createPrismaClient();
  const cleanup = new CleanupRetainedData(new PrismaDataRetentionRepository(prisma));
  const abort = new AbortController();
  let stopping = false;

  const requestStop = () => {
    if (stopping) return;
    stopping = true;
    logger.info('Retention worker shutting down', { operation: 'retention-worker' });
    abort.abort();
  };
  process.on('SIGINT', requestStop);
  process.on('SIGTERM', requestStop);

  logger.info('Retention worker started', {
    operation: 'retention-worker',
    telemetryRetentionHours: env.telemetryRetentionHours,
    publishedOutboxRetentionHours: env.publishedOutboxRetentionHours,
    processedMessageRetentionHours: env.processedMessageRetentionHours,
    intervalMinutes: env.retentionIntervalMinutes,
  });

  while (!stopping) {
    const now = new Date();
    const started = Date.now();
    try {
      const result = await cleanup.execute({
        now,
        telemetryRetentionMs: env.telemetryRetentionMs,
        publishedOutboxRetentionMs: env.publishedOutboxRetentionMs,
        processedMessageRetentionMs: env.processedMessageRetentionMs,
      });
      const fields = {
        operation: 'retention-cleanup',
        telemetryDeleted: result.telemetryDeleted,
        publishedOutboxDeleted: result.outboxDeleted,
        processedMessagesDeleted: result.processedMessagesDeleted,
        durationMs: Date.now() - started,
      };
      if (
        result.telemetryDeleted === 0 &&
        result.outboxDeleted === 0 &&
        result.processedMessagesDeleted === 0
      ) {
        logger.debug('Retention cleanup complete', fields);
      } else {
        logger.info('Retention cleanup complete', fields);
      }
    } catch (err) {
      logger.error('Retention cleanup failed', {
        operation: 'retention-cleanup',
        errorCode: 'CLEANUP_FAILED',
        err: err instanceof Error ? err.message : String(err),
      });
    }

    if (stopping) break;
    await delay(env.intervalMs, abort.signal);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
