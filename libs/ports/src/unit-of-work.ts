import { RobotCurrentStateRepository } from './robot-current-state-repository';
import { RobotRepository } from './robot-repository';
import { RobotTelemetryRepository } from './robot-telemetry-repository';

export interface TransactionalRepos {
  robots: RobotRepository;
  currentState: RobotCurrentStateRepository;
  telemetry: RobotTelemetryRepository;
}

/**
 * Application-facing unit of work. Implementations must not leak
 * Prisma clients, SQL connections, or raw transaction objects.
 */
export interface UnitOfWork {
  execute<T>(fn: (repos: TransactionalRepos) => Promise<T>): Promise<T>;
}
