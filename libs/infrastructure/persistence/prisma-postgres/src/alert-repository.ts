import {
  Alert,
  AlertSeverity,
  AlertStatus,
  AlertType,
} from '@prc/domain';
import { AlertRepository } from '@prc/ports';
import { Prisma, PrismaClient } from '@prisma/client';

type Client = PrismaClient | Prisma.TransactionClient;

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
}

export type { AlertSeverity, AlertStatus };
