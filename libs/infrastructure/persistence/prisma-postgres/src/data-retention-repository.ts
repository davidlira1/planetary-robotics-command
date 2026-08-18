import { DataRetentionRepository } from '@prc/ports';
import { Prisma, PrismaClient } from '@prisma/client';

type Client = PrismaClient | Prisma.TransactionClient;

/**
 * Deletes expired operational rows with Prisma `deleteMany`.
 * Appropriate for the current 10-robot / 2-hour portfolio volume (~36k telemetry
 * rows). Each method is isolated so a later LIMIT-batch loop can replace
 * `deleteMany` without changing the port.
 */
export class PrismaDataRetentionRepository implements DataRetentionRepository {
  constructor(private readonly db: Client) {}

  async deleteTelemetryBefore(cutoff: Date): Promise<number> {
    const result = await this.db.robotTelemetry.deleteMany({
      where: { receivedAt: { lt: cutoff } },
    });
    return result.count;
  }

  async deletePublishedOutboxBefore(cutoff: Date): Promise<number> {
    const result = await this.db.outboxMessage.deleteMany({
      where: { publishedAt: { not: null, lt: cutoff } },
    });
    return result.count;
  }

  async deleteProcessedMessagesBefore(cutoff: Date): Promise<number> {
    const result = await this.db.processedMessage.deleteMany({
      where: { processedAt: { lt: cutoff } },
    });
    return result.count;
  }
}
