import { Position } from './position';

export interface RobotCurrentState {
  robotId: string;
  position: Position;
  batteryPercent: number;
  temperatureCelsius: number;
  signalStrengthDbm: number;
  velocityMetersPerSecond: number;
  headingDegrees: number;
  recordedAt: Date;
  receivedAt: Date;
}
