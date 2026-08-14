import {
  BeginProcessingResult,
  ProcessedMessageRepository,
} from '@prc/ports';
import { Prisma, PrismaClient } from '@prisma/client';

type Client = PrismaClient | Prisma.TransactionClient;

export class PrismaProcessedMessageRepository
  implements ProcessedMessageRepository
{
  constructor(private readonly db: Client) {}

  async tryBeginProcessing(
    consumer: string,
    eventId: string,
  ): Promise<BeginProcessingResult> {
    try {
      await this.db.processedMessage.create({
        data: {
          consumer,
          eventId,
          processedAt: new Date(),
        },
      });
      return { acquired: true };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return { acquired: false, reason: 'duplicate' };
      }
      throw err;
    }
  }
}
