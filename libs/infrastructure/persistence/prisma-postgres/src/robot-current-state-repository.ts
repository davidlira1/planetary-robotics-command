import { RobotCurrentState } from '@prc/domain';
import { RobotCurrentStateRepository } from '@prc/ports';
import { Prisma, PrismaClient } from '@prisma/client';
import { toDomainCurrentState } from './mappers';

type Client = PrismaClient | Prisma.TransactionClient;

export class PrismaRobotCurrentStateRepository
  implements RobotCurrentStateRepository
{
  constructor(private readonly db: Client) {}

  async findByRobotId(robotId: string): Promise<RobotCurrentState | null> {
    const row = await this.db.robotCurrentState.findUnique({
      where: { robotId },
    });
    return row ? toDomainCurrentState(row) : null;
  }

  /**
   * Atomic insert-or-update only when EXCLUDED.recordedAt > stored.recordedAt.
   * Equal timestamps keep the existing current state (recordedAt is sole authority).
   */
  async updateIfNewer(state: RobotCurrentState): Promise<void> {
    await this.db.$executeRaw`
      INSERT INTO "RobotCurrentState" (
        "robotId",
        "positionX",
        "positionY",
        "positionZ",
        "batteryPercent",
        "temperatureCelsius",
        "signalStrengthDbm",
        "velocityMetersPerSecond",
        "headingDegrees",
        "recordedAt",
        "receivedAt"
      ) VALUES (
        ${state.robotId},
        ${state.position.x},
        ${state.position.y},
        ${state.position.z},
        ${state.batteryPercent},
        ${state.temperatureCelsius},
        ${state.signalStrengthDbm},
        ${state.velocityMetersPerSecond},
        ${state.headingDegrees},
        ${state.recordedAt},
        ${state.receivedAt}
      )
      ON CONFLICT ("robotId") DO UPDATE SET
        "positionX" = EXCLUDED."positionX",
        "positionY" = EXCLUDED."positionY",
        "positionZ" = EXCLUDED."positionZ",
        "batteryPercent" = EXCLUDED."batteryPercent",
        "temperatureCelsius" = EXCLUDED."temperatureCelsius",
        "signalStrengthDbm" = EXCLUDED."signalStrengthDbm",
        "velocityMetersPerSecond" = EXCLUDED."velocityMetersPerSecond",
        "headingDegrees" = EXCLUDED."headingDegrees",
        "recordedAt" = EXCLUDED."recordedAt",
        "receivedAt" = EXCLUDED."receivedAt"
      WHERE EXCLUDED."recordedAt" > "RobotCurrentState"."recordedAt"
    `;
  }
}
