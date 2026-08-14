import { TransactionalRepos, UnitOfWork } from '@prc/ports';
import { PrismaClient } from '@prisma/client';
import { PrismaAlertRepository } from './alert-repository';
import { PrismaOutboxRepository } from './outbox-repository';
import { PrismaProcessedMessageRepository } from './processed-message-repository';
import { PrismaRobotCurrentStateRepository } from './robot-current-state-repository';
import { PrismaRobotHealthRepository } from './robot-health-repository';
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
        outbox: new PrismaOutboxRepository(tx),
        health: new PrismaRobotHealthRepository(tx),
        alerts: new PrismaAlertRepository(tx),
        processedMessages: new PrismaProcessedMessageRepository(tx),
      };
      return fn(repos);
    });
  }
}
