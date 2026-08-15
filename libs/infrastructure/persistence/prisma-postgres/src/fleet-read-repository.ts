import { FleetReadRepository, FleetSnapshot } from '@prc/application';
import {
  HealthDimensionStatus,
  RobotHealthState,
  RobotHealthStatus,
} from '@prc/domain';
import { PrismaClient } from '@prisma/client';
import { toDomainCurrentState, toDomainRobot } from './mappers';

function toDomainHealth(row: {
  robotId: string;
  status: string;
  batteryStatus: string;
  temperatureStatus: string;
  signalStatus: string;
  evaluatedFromTelemetryId: string;
  evaluatedFromRecordedAt: Date;
  updatedAt: Date;
}): RobotHealthState {
  return {
    robotId: row.robotId,
    status: row.status as RobotHealthStatus,
    batteryStatus: row.batteryStatus as HealthDimensionStatus,
    temperatureStatus: row.temperatureStatus as HealthDimensionStatus,
    signalStatus: row.signalStatus as HealthDimensionStatus,
    evaluatedFromTelemetryId: row.evaluatedFromTelemetryId,
    evaluatedFromRecordedAt: row.evaluatedFromRecordedAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaFleetReadRepository implements FleetReadRepository {
  constructor(private readonly db: PrismaClient) {}

  async getSnapshot(): Promise<FleetSnapshot> {
    const rows = await this.db.robot.findMany({
      orderBy: { id: 'asc' },
      include: {
        currentState: true,
        healthState: true,
      },
    });

    return {
      robots: rows.map((row) => {
        const robot = toDomainRobot(row);
        return {
          id: robot.id,
          displayName: robot.displayName,
          type: robot.type,
          model: robot.model,
          operationalStatus: robot.operationalStatus,
          currentState: row.currentState
            ? toDomainCurrentState(row.currentState)
            : null,
          health: row.healthState ? toDomainHealth(row.healthState) : null,
        };
      }),
    };
  }
}
