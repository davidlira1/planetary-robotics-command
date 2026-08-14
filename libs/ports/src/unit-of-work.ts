import { AlertRepository } from './alert-repository';
import { OutboxRepository } from './outbox-repository';
import { ProcessedMessageRepository } from './processed-message-repository';
import { RobotCurrentStateRepository } from './robot-current-state-repository';
import { RobotHealthRepository } from './robot-health-repository';
import { RobotRepository } from './robot-repository';
import { RobotTelemetryRepository } from './robot-telemetry-repository';

export interface TransactionalRepos {
  robots: RobotRepository;
  currentState: RobotCurrentStateRepository;
  telemetry: RobotTelemetryRepository;
  outbox: OutboxRepository;
  health: RobotHealthRepository;
  alerts: AlertRepository;
  processedMessages: ProcessedMessageRepository;
}

/**
 * Application-facing unit of work. Implementations must not leak
 * Prisma clients, SQL connections, or raw transaction objects.
 */
export interface UnitOfWork {
  execute<T>(fn: (repos: TransactionalRepos) => Promise<T>): Promise<T>;
}
