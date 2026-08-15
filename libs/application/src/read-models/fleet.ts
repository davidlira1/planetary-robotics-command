import {
  RobotCurrentState,
  RobotHealthState,
  RobotOperationalStatus,
  RobotType,
} from '@prc/domain';

export interface FleetRobot {
  id: string;
  displayName: string;
  type: RobotType;
  model: string;
  operationalStatus: RobotOperationalStatus;
  currentState: RobotCurrentState | null;
  health: RobotHealthState | null;
}

export interface FleetSnapshot {
  robots: FleetRobot[];
}
