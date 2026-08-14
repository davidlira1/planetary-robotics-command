import { AlertSeverity, AlertStatus, AlertType } from './health-enums';

export interface Alert {
  id: string;
  robotId: string;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string;
  sourceTelemetryId: string;
  sourceEventId: string;
  createdAt: Date;
  acknowledgedAt: Date | null;
  acknowledgedBy: string | null;
}
