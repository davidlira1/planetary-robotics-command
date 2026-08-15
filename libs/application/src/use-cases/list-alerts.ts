import { Alert, AlertSeverity, AlertStatus } from '@prc/domain';
import { AlertRepository } from '@prc/ports';
import { decodeAlertCursor, encodeAlertCursor } from '../pagination';

export interface ListAlertsInput {
  robotId?: string;
  severity?: AlertSeverity;
  status?: AlertStatus;
  limit: number;
  cursor?: string;
}

export interface ListAlertsResult {
  items: Alert[];
  page: { limit: number; nextCursor: string | null };
}

export class ListAlerts {
  constructor(private readonly alerts: AlertRepository) {}

  async execute(input: ListAlertsInput): Promise<ListAlertsResult> {
    const cursor = input.cursor ? decodeAlertCursor(input.cursor) : undefined;
    const result = await this.alerts.list({
      robotId: input.robotId,
      severity: input.severity,
      status: input.status,
      limit: input.limit,
      cursor,
    });

    return {
      items: result.items,
      page: {
        limit: input.limit,
        nextCursor: result.nextCursor
          ? encodeAlertCursor(
              result.nextCursor.createdAt,
              result.nextCursor.alertId,
            )
          : null,
      },
    };
  }
}
