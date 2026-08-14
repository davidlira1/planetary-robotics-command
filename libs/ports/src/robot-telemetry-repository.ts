import { RobotTelemetry } from '@prc/domain';

export type TelemetryOrder = 'asc' | 'desc';

export interface TelemetryQuery {
  robotId: string;
  from?: Date;
  to?: Date;
  limit: number;
  order: TelemetryOrder;
  /** Compound cursor: last recordedAt + telemetryId from previous page. */
  cursor?: { recordedAt: Date; telemetryId: string };
}

export interface TelemetryListResult {
  items: RobotTelemetry[];
  nextCursor: { recordedAt: Date; telemetryId: string } | null;
}

export interface RobotTelemetryRepository {
  append(telemetry: RobotTelemetry): Promise<void>;
  findByRobotIdAndSource(
    robotId: string,
    sourceTelemetryId: string,
  ): Promise<RobotTelemetry | null>;
  findByRobotId(query: TelemetryQuery): Promise<TelemetryListResult>;
}
