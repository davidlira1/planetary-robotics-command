import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Nest-friendly Prisma client. Lives in the API composition root so
 * @nestjs/common is not imported by the persistence library itself.
 * Re-exported pattern: the persistence package exposes plain PrismaClient wrappers;
 * this thin subclass adds Nest lifecycle hooks.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async isReady(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
