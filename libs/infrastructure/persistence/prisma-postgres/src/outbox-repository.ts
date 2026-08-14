import { OutboxMessage, OutboxRepository } from '@prc/ports';
import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

type Client = PrismaClient | Prisma.TransactionClient;

function toDomain(row: {
  id: string;
  eventId: string;
  eventType: string;
  eventVersion: number;
  occurredAt: Date;
  correlationId: string;
  causationId: string;
  payloadJson: string;
  createdAt: Date;
  publishedAt: Date | null;
  publishAttempts: number;
  lastPublishError: string | null;
  claimedUntil: Date | null;
}): OutboxMessage {
  return { ...row };
}

export class PrismaOutboxRepository implements OutboxRepository {
  constructor(private readonly db: Client) {}

  async append(message: OutboxMessage): Promise<void> {
    await this.db.outboxMessage.create({
      data: {
        id: message.id,
        eventId: message.eventId,
        eventType: message.eventType,
        eventVersion: message.eventVersion,
        occurredAt: message.occurredAt,
        correlationId: message.correlationId,
        causationId: message.causationId,
        payloadJson: message.payloadJson,
        createdAt: message.createdAt,
        publishedAt: message.publishedAt,
        publishAttempts: message.publishAttempts,
        lastPublishError: message.lastPublishError,
        claimedUntil: message.claimedUntil,
      },
    });
  }

  /**
   * Short claim transaction. When `db` is already a TransactionClient this still
   * runs the claim SQL in that tx — publishers should call this on a root PrismaClient
   * so the adapter can open/commit its own short transaction.
   */
  async claimPending(
    batchSize: number,
    claimDurationMs: number,
  ): Promise<OutboxMessage[]> {
    const root = this.db as PrismaClient;
    if (typeof root.$transaction !== 'function') {
      throw new Error(
        'claimPending must be invoked with a root PrismaClient (short claim txn)',
      );
    }

    const now = new Date();
    const claimedUntil = new Date(now.getTime() + claimDurationMs);

    return root.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{
          id: string;
          eventId: string;
          eventType: string;
          eventVersion: number;
          occurredAt: Date;
          correlationId: string;
          causationId: string;
          payloadJson: string;
          createdAt: Date;
          publishedAt: Date | null;
          publishAttempts: number;
          lastPublishError: string | null;
          claimedUntil: Date | null;
        }>
      >`
        SELECT *
        FROM "OutboxMessage"
        WHERE "publishedAt" IS NULL
          AND ("claimedUntil" IS NULL OR "claimedUntil" < ${now})
        ORDER BY "createdAt" ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      `;

      if (rows.length === 0) return [];

      const ids = rows.map((r) => r.id);
      await tx.outboxMessage.updateMany({
        where: { id: { in: ids } },
        data: { claimedUntil },
      });

      return rows.map((r) => toDomain({ ...r, claimedUntil }));
    });
  }

  async markPublished(outboxId: string, publishedAt: Date): Promise<void> {
    await this.db.outboxMessage.update({
      where: { id: outboxId },
      data: {
        publishedAt,
        claimedUntil: null,
        lastPublishError: null,
      },
    });
  }

  async recordPublishFailure(outboxId: string, error: string): Promise<void> {
    await this.db.outboxMessage.update({
      where: { id: outboxId },
      data: {
        publishAttempts: { increment: 1 },
        lastPublishError: error.slice(0, 1000),
        claimedUntil: null,
      },
    });
  }
}

export function newOutboxId(): string {
  return `obx_${randomUUID().replace(/-/g, '').slice(0, 26)}`;
}
