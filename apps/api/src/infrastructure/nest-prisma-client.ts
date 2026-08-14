import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { DatabaseReadiness } from '@prc/ports';
import { isDatabaseReady } from '@prc/persistence-prisma';
import { PrismaClient } from '@prisma/client';

/**
 * Nest composition-root glue around PrismaClient.
 * Not application persistence logic — only lifecycle + readiness for DI wiring.
 * @prc/persistence-prisma remains Nest-free.
 */
@Injectable()
export class NestPrismaClient
  extends PrismaClient
  implements OnModuleDestroy, DatabaseReadiness
{
  async isReady(): Promise<boolean> {
    return isDatabaseReady(this);
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
