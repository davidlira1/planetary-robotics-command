import type { FleetRobot } from '../core/models';
import { resolveRobotWorldType, type RobotWorldRobot } from './robot-world';

export function mapFleetToWorldRobots(robots: readonly FleetRobot[]): RobotWorldRobot[] {
  return robots.flatMap((robot) => {
    if (!robot.currentState) {
      return [];
    }
    return [
      {
        id: robot.id,
        type: resolveRobotWorldType(robot.type),
        position: robot.currentState.position,
        headingDegrees: robot.currentState.headingDegrees,
        healthStatus: robot.health?.status ?? null,
      },
    ];
  });
}
