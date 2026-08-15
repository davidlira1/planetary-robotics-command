import { Robot, RobotCurrentState, RobotHealthState } from '@prc/domain';
import {
  RobotCurrentStateRepository,
  RobotHealthRepository,
  RobotRepository,
} from '@prc/ports';
import { RobotNotFoundError } from '../errors';

export interface GetRobotResult {
  robot: Robot;
  currentState: RobotCurrentState | null;
  health: RobotHealthState | null;
}

export class GetRobot {
  constructor(
    private readonly robots: RobotRepository,
    private readonly currentState: RobotCurrentStateRepository,
    private readonly health: RobotHealthRepository,
  ) {}

  async execute(robotId: string): Promise<GetRobotResult> {
    const robot = await this.robots.findById(robotId);
    if (!robot) {
      throw new RobotNotFoundError(robotId);
    }
    const [currentState, health] = await Promise.all([
      this.currentState.findByRobotId(robotId),
      this.health.findByRobotId(robotId),
    ]);
    return { robot, currentState, health };
  }
}
