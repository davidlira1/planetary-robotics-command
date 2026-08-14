import { Position } from './position';

export interface RobotTelemetry {
  id: string;
  robotId: string;
  sourceTelemetryId: string;
  schemaVersion: number;
  position: Position;
  batteryPercent: number;
  temperatureCelsius: number;
  signalStrengthDbm: number;
  velocityMetersPerSecond: number;
  headingDegrees: number;
  recordedAt: Date;
  receivedAt: Date;
}
