import { RobotTelemetry } from '@prc/domain';
import {
  RobotTelemetryRepository,
  TelemetryListResult,
  TelemetryQuery,
} from '@prc/ports';
import { Prisma, PrismaClient } from '@prisma/client';
import { toDomainTelemetry } from './mappers';

type Client = PrismaClient | Prisma.TransactionClient;

export class PrismaRobotTelemetryRepository
  implements RobotTelemetryRepository
{
  constructor(private readonly db: Client) {}

  async append(telemetry: RobotTelemetry): Promise<void> {
    await this.db.robotTelemetry.create({
      data: {
        id: telemetry.id,
        robotId: telemetry.robotId,
        sourceTelemetryId: telemetry.sourceTelemetryId,
        schemaVersion: telemetry.schemaVersion,
        positionX: telemetry.position.x,
        positionY: telemetry.position.y,
        positionZ: telemetry.position.z,
        batteryPercent: telemetry.batteryPercent,
        temperatureCelsius: telemetry.temperatureCelsius,
        signalStrengthDbm: telemetry.signalStrengthDbm,
        velocityMetersPerSecond: telemetry.velocityMetersPerSecond,
        headingDegrees: telemetry.headingDegrees,
        recordedAt: telemetry.recordedAt,
        receivedAt: telemetry.receivedAt,
      },
    });
  }

  async findByRobotIdAndSource(
    robotId: string,
    sourceTelemetryId: string,
  ): Promise<RobotTelemetry | null> {
    const row = await this.db.robotTelemetry.findUnique({
      where: {
        robotId_sourceTelemetryId: { robotId, sourceTelemetryId },
      },
    });
    return row ? toDomainTelemetry(row) : null;
  }

  async findByRobotId(query: TelemetryQuery): Promise<TelemetryListResult> {
    const where: Prisma.RobotTelemetryWhereInput = {
      robotId: query.robotId,
    };

    if (query.from || query.to) {
      where.recordedAt = {};
      if (query.from) where.recordedAt.gte = query.from;
      if (query.to) where.recordedAt.lte = query.to;
    }

    if (query.cursor) {
      if (query.order === 'desc') {
        where.AND = [
          {
            OR: [
              { recordedAt: { lt: query.cursor.recordedAt } },
              {
                recordedAt: query.cursor.recordedAt,
                id: { lt: query.cursor.telemetryId },
              },
            ],
          },
        ];
      } else {
        where.AND = [
          {
            OR: [
              { recordedAt: { gt: query.cursor.recordedAt } },
              {
                recordedAt: query.cursor.recordedAt,
                id: { gt: query.cursor.telemetryId },
              },
            ],
          },
        ];
      }
    }

    const rows = await this.db.robotTelemetry.findMany({
      where,
      orderBy:
        query.order === 'desc'
          ? [{ recordedAt: 'desc' }, { id: 'desc' }]
          : [{ recordedAt: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
    });

    const page = rows.slice(0, query.limit);
    const hasMore = rows.length > query.limit;
    const last = page[page.length - 1];

    return {
      items: page.map(toDomainTelemetry),
      nextCursor:
        hasMore && last
          ? { recordedAt: last.recordedAt, telemetryId: last.id }
          : null,
    };
  }
}
