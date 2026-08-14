import { Alert } from '@prc/domain';

export interface AlertRepository {
  append(alert: Alert): Promise<void>;
  countByRobotAndType(robotId: string, type: string): Promise<number>;
}
