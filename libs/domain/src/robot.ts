import { RobotOperationalStatus, RobotType } from './enums';

export interface Robot {
  id: string;
  displayName: string;
  type: RobotType;
  model: string;
  operationalStatus: RobotOperationalStatus;
  createdAt: Date;
  updatedAt: Date;
}
