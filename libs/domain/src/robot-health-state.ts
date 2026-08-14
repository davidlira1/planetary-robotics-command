import {
  HealthDimensionStatus,
  RobotHealthStatus,
} from './health-enums';

export interface RobotHealthState {
  robotId: string;
  status: RobotHealthStatus;
  batteryStatus: HealthDimensionStatus;
  temperatureStatus: HealthDimensionStatus;
  signalStatus: HealthDimensionStatus;
  evaluatedFromTelemetryId: string;
  evaluatedFromRecordedAt: Date;
  updatedAt: Date;
}
