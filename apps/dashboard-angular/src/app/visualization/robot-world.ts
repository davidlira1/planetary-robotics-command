export const ROBOT_WORLD_TYPES = ['DRONE', 'HAULER', 'MINER', 'WORKER', 'SCOUT'] as const;

export type RobotWorldType = (typeof ROBOT_WORLD_TYPES)[number] | 'UNKNOWN';

export function resolveRobotWorldType(type: string): RobotWorldType {
  switch (type) {
    case 'DRONE':
    case 'HAULER':
    case 'MINER':
    case 'WORKER':
    case 'SCOUT':
      return type;
    default:
      return 'UNKNOWN';
  }
}

export interface RobotWorldRobot {
  id: string;
  type: RobotWorldType;
  position: { x: number; y: number; z: number } | null;
  headingDegrees: number;
  healthStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' | null;
}

export interface RobotWorld {
  initialize(host: HTMLElement, hooks: { onRobotSelected(id: string): void }): void;
  syncFleet(robots: readonly RobotWorldRobot[]): void;
  setSelectedRobot(robotId: string | null): void;
  fitFleet(): void;
  /**
   * Animates the camera to a useful inspection distance from the robot.
   * Preserves the current viewing direction relative to the orbit target.
   */
  focusRobot(robotId: string): void;
  resize(width: number, height: number): void;
  destroy(): void;
}
