import { TransactionalRepos, UnitOfWork } from '@prc/ports';
import { PrismaClient } from '@prisma/client';
import { PrismaRobotCurrentStateRepository } from './robot-current-state-repository';
import { PrismaRobotRepository } from './robot-repository';
import { PrismaRobotTelemetryRepository } from './robot-telemetry-repository';

export class PrismaUnitOfWork implements UnitOfWork {
  constructor(private readonly prisma: PrismaClient) {}

  async execute<T>(fn: (repos: TransactionalRepos) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const repos: TransactionalRepos = {
        robots: new PrismaRobotRepository(tx),
        currentState: new PrismaRobotCurrentStateRepository(tx),
        telemetry: new PrismaRobotTelemetryRepository(tx),
      };
      return fn(repos);
    });
  }
}
