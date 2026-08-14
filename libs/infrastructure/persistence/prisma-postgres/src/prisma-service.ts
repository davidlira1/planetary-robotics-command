import { PrismaClient } from '@prisma/client';

/** Framework-free Prisma client factory helpers for adapters and tests. */
export function createPrismaClient(): PrismaClient {
  return new PrismaClient();
}

export async function isDatabaseReady(client: PrismaClient): Promise<boolean> {
  try {
    await client.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
