import type * as THREE from 'three';
import type { RobotWorldRobot } from '../robot-world';

export interface RobotVisualTelemetry {
  velocityMetersPerSecond: number;
}

export interface RobotVisualState {
  healthStatus: RobotWorldRobot['healthStatus'];
  selected: boolean;
  hovered: boolean;
}

export interface RobotVisual {
  readonly group: THREE.Group;
  updateVisualState(state: RobotVisualState): void;
  tick(deltaSeconds: number, telemetry: RobotVisualTelemetry): void;
  dispose(): void;
}
