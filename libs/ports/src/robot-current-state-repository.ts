import { RobotCurrentState } from '@prc/domain';

export interface RobotCurrentStateRepository {
  findByRobotId(robotId: string): Promise<RobotCurrentState | null>;
  /**
   * Atomically insert or update only when incoming.recordedAt is strictly
   * greater than the stored recordedAt. Equal timestamps keep existing state.
   */
  updateIfNewer(currentState: RobotCurrentState): Promise<void>;
}
