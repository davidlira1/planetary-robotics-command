import {
  Robot,
  RobotCurrentState,
  RobotOperationalStatus,
  RobotType,
} from '@prc/domain';
import { RobotRepository } from '@prc/ports';
import { decodeRobotCursor, encodeRobotCursor } from '../pagination';

export interface ListRobotsInput {
  type?: RobotType;
  status?: RobotOperationalStatus;
  limit: number;
  cursor?: string;
}

export interface ListRobotsResult {
  items: Array<{ robot: Robot; currentState: RobotCurrentState | null }>;
  page: { limit: number; nextCursor: string | null };
}

export class ListRobots {
  constructor(private readonly robots: RobotRepository) {}

  async execute(input: ListRobotsInput): Promise<ListRobotsResult> {
    const cursorId = input.cursor ? decodeRobotCursor(input.cursor) : undefined;
    const result = await this.robots.findAll({
      type: input.type,
      status: input.status,
      limit: input.limit,
      cursorId,
    });

    return {
      items: result.items,
      page: {
        limit: input.limit,
        nextCursor: result.nextCursorId
          ? encodeRobotCursor(result.nextCursorId)
          : null,
      },
    };
  }
}
