import { Alert, AlertSeverity, AlertStatus } from '@prc/domain';

export interface AlertListQuery {
  robotId?: string;
  severity?: AlertSeverity;
  status?: AlertStatus;
  limit: number;
  /** Compound cursor: last createdAt + alertId from previous page (DESC). */
  cursor?: { createdAt: Date; alertId: string };
}

export interface AlertListResult {
  items: Alert[];
  nextCursor: { createdAt: Date; alertId: string } | null;
}

export interface AlertRepository {
  append(alert: Alert): Promise<void>;
  countByRobotAndType(robotId: string, type: string): Promise<number>;
  list(query: AlertListQuery): Promise<AlertListResult>;
}
