import {
  HealthDimensionStatus,
  RobotHealthState,
  RobotHealthStatus,
} from '@prc/domain';
import { RobotHealthRepository } from '@prc/ports';
import { Prisma, PrismaClient } from '@prisma/client';

type Client = PrismaClient | Prisma.TransactionClient;

function toDomain(row: {
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

export class PrismaRobotHealthRepository implements RobotHealthRepository {
  constructor(private readonly db: Client) {}

  async findByRobotIdForUpdate(robotId: string): Promise<RobotHealthState | null> {
    const rows = await this.db.$queryRaw<
      Array<{
        robotId: string;
        status: string;
        batteryStatus: string;
        temperatureStatus: string;
        signalStatus: string;
        evaluatedFromTelemetryId: string;
        evaluatedFromRecordedAt: Date;
        updatedAt: Date;
      }>
    >`
      SELECT *
      FROM "RobotHealthState"
      WHERE "robotId" = ${robotId}
      FOR UPDATE
    `;
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async updateIfNewer(state: RobotHealthState): Promise<void> {
    await this.db.$executeRaw`
      INSERT INTO "RobotHealthState" (
        "robotId",
        "status",
        "batteryStatus",
        "temperatureStatus",
        "signalStatus",
        "evaluatedFromTelemetryId",
        "evaluatedFromRecordedAt",
        "updatedAt"
      ) VALUES (
        ${state.robotId},
        ${state.status}::"RobotHealthStatus",
        ${state.batteryStatus}::"HealthDimensionStatus",
        ${state.temperatureStatus}::"HealthDimensionStatus",
        ${state.signalStatus}::"HealthDimensionStatus",
        ${state.evaluatedFromTelemetryId},
        ${state.evaluatedFromRecordedAt},
        ${state.updatedAt}
      )
      ON CONFLICT ("robotId") DO UPDATE SET
        "status" = EXCLUDED."status",
        "batteryStatus" = EXCLUDED."batteryStatus",
        "temperatureStatus" = EXCLUDED."temperatureStatus",
        "signalStatus" = EXCLUDED."signalStatus",
        "evaluatedFromTelemetryId" = EXCLUDED."evaluatedFromTelemetryId",
        "evaluatedFromRecordedAt" = EXCLUDED."evaluatedFromRecordedAt",
        "updatedAt" = EXCLUDED."updatedAt"
      WHERE EXCLUDED."evaluatedFromRecordedAt" > "RobotHealthState"."evaluatedFromRecordedAt"
    `;
  }
}
