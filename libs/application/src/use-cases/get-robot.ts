import { Robot, RobotCurrentState } from '@prc/domain';
import {
  RobotCurrentStateRepository,
  RobotRepository,
} from '@prc/ports';
import { RobotNotFoundError } from '../errors';

export interface GetRobotResult {
  robot: Robot;
  currentState: RobotCurrentState | null;
}

export class GetRobot {
  constructor(
    private readonly robots: RobotRepository,
    private readonly currentState: RobotCurrentStateRepository,
  ) {}

  async execute(robotId: string): Promise<GetRobotResult> {
    const robot = await this.robots.findById(robotId);
    if (!robot) {
      throw new RobotNotFoundError(robotId);
    }
    const currentState = await this.currentState.findByRobotId(robotId);
    return { robot, currentState };
  }
}
