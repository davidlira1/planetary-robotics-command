import {
  Robot,
  RobotCurrentState,
  RobotOperationalStatus,
  RobotTelemetry,
  RobotType,
} from '@prc/domain';

export interface RobotListFilters {
  type?: RobotType;
  status?: RobotOperationalStatus;
  limit: number;
  /** Exclusive lower bound on robot id (ASC pagination). */
  cursorId?: string;
}

export interface RobotListResult {
  items: Array<{ robot: Robot; currentState: RobotCurrentState | null }>;
  nextCursorId: string | null;
}

export interface RobotRepository {
  findAll(filters: RobotListFilters): Promise<RobotListResult>;
  findById(robotId: string): Promise<Robot | null>;
  exists(robotId: string): Promise<boolean>;
}
