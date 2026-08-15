import { RobotHealthState } from '@prc/domain';

export interface RobotHealthRepository {
  /** Non-locking read for dashboard / robot detail. */
  findByRobotId(robotId: string): Promise<RobotHealthState | null>;
  /** Lock the health row for this robot (or absence) within the current transaction. */
  findByRobotIdForUpdate(robotId: string): Promise<RobotHealthState | null>;
  /** Insert or update only when incoming evaluatedFromRecordedAt is strictly newer. */
  updateIfNewer(state: RobotHealthState): Promise<void>;
}
