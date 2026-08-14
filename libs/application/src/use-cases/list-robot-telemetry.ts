import { RobotTelemetry } from '@prc/domain';
import {
  RobotRepository,
  RobotTelemetryRepository,
  TelemetryOrder,
} from '@prc/ports';
import {
  InvalidTimeRangeError,
  RobotNotFoundError,
} from '../errors';
import {
  decodeTelemetryCursor,
  encodeTelemetryCursor,
} from '../pagination';

export interface ListRobotTelemetryInput {
  robotId: string;
  from?: Date;
  to?: Date;
  limit: number;
  cursor?: string;
  order: TelemetryOrder;
}

export interface ListRobotTelemetryResult {
  robotId: string;
  items: RobotTelemetry[];
  page: { limit: number; nextCursor: string | null };
}

export class ListRobotTelemetry {
  constructor(
    private readonly robots: RobotRepository,
    private readonly telemetry: RobotTelemetryRepository,
  ) {}

  async execute(
    input: ListRobotTelemetryInput,
  ): Promise<ListRobotTelemetryResult> {
    const exists = await this.robots.exists(input.robotId);
    if (!exists) {
      throw new RobotNotFoundError(input.robotId);
    }

    if (input.from && input.to && input.from.getTime() > input.to.getTime()) {
      throw new InvalidTimeRangeError();
    }

    const cursor = input.cursor
      ? decodeTelemetryCursor(input.cursor)
      : undefined;

    const result = await this.telemetry.findByRobotId({
      robotId: input.robotId,
      from: input.from,
      to: input.to,
      limit: input.limit,
      order: input.order,
      cursor,
    });

    return {
      robotId: input.robotId,
      items: result.items,
      page: {
        limit: input.limit,
        nextCursor: result.nextCursor
          ? encodeTelemetryCursor(
              result.nextCursor.recordedAt,
              result.nextCursor.telemetryId,
            )
          : null,
      },
    };
  }
}
