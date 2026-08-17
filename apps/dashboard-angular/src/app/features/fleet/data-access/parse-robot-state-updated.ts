import { RobotStateUpdatedV1Schema, type RobotStateUpdatedV1 } from '@prc/contracts';

export function parseRobotStateUpdated(data: unknown): RobotStateUpdatedV1 | null {
  let raw: unknown = data;
  if (typeof data === 'string') {
    try {
      raw = JSON.parse(data) as unknown;
    } catch {
      return null;
    }
  }
  const parsed = RobotStateUpdatedV1Schema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
