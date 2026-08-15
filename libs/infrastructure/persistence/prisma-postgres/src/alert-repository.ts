import {
  Alert,
  AlertSeverity,
  AlertStatus,
  AlertType,
} from '@prc/domain';
import {
  AlertListQuery,
  AlertListResult,
  AlertRepository,
} from '@prc/ports';
import { Prisma, PrismaClient } from '@prisma/client';

type Client = PrismaClient | Prisma.TransactionClient;

function toDomainAlert(row: {
  id: string;
  robotId: string;
  type: string;
  severity: string;
  status: string;
  title: string;
  message: string;
  sourceTelemetryId: string;
  sourceEventId: string;
  createdAt: Date;
  acknowledgedAt: Date | null;
  acknowledgedBy: string | null;
}): Alert {
  return {
    id: row.id,
    robotId: row.robotId,
    type: row.type as AlertType,
    severity: row.severity as AlertSeverity,
    status: row.status as AlertStatus,
    title: row.title,
    message: row.message,
    sourceTelemetryId: row.sourceTelemetryId,
    sourceEventId: row.sourceEventId,
    createdAt: row.createdAt,
    acknowledgedAt: row.acknowledgedAt,
    acknowledgedBy: row.acknowledgedBy,
  };
}

export class PrismaAlertRepository implements AlertRepository {
  constructor(private readonly db: Client) {}

  async append(alert: Alert): Promise<void> {
    await this.db.alert.create({
      data: {
        id: alert.id,
        robotId: alert.robotId,
        type: alert.type,
        severity: alert.severity,
        status: alert.status,
        title: alert.title,
        message: alert.message,
        sourceTelemetryId: alert.sourceTelemetryId,
        sourceEventId: alert.sourceEventId,
        createdAt: alert.createdAt,
        acknowledgedAt: alert.acknowledgedAt,
        acknowledgedBy: alert.acknowledgedBy,
      },
    });
  }

  async countByRobotAndType(robotId: string, type: string): Promise<number> {
    return this.db.alert.count({
      where: { robotId, type: type as AlertType },
    });
  }

  async list(query: AlertListQuery): Promise<AlertListResult> {
    const where: Prisma.AlertWhereInput = {};
    if (query.robotId) where.robotId = query.robotId;
    if (query.severity) where.severity = query.severity;
    if (query.status) where.status = query.status;

    if (query.cursor) {
      where.AND = [
        {
          OR: [
            { createdAt: { lt: query.cursor.createdAt } },
            {
              createdAt: query.cursor.createdAt,
              id: { lt: query.cursor.alertId },
            },
          ],
        },
      ];
    }

    const rows = await this.db.alert.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });

    const hasMore = rows.length > query.limit;
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
    const last = pageRows[pageRows.length - 1];

    return {
      items: pageRows.map(toDomainAlert),
      nextCursor:
        hasMore && last
          ? { createdAt: last.createdAt, alertId: last.id }
          : null,
    };
  }
}

export type { AlertSeverity, AlertStatus };
