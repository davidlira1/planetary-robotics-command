import {
  Position,
  RobotCurrentState,
  RobotTelemetry,
  TELEMETRY_SCHEMA_VERSION_V1,
} from '@prc/domain';
import { Logger, UnitOfWork } from '@prc/ports';
import { ulid } from 'ulid';
import { IdempotencyConflictError, RobotNotFoundError } from '../errors';

export interface IngestTelemetryInput {
  sourceTelemetryId: string;
  robotId: string;
  schemaVersion: number;
  recordedAt: Date;
  position: Position;
  batteryPercent: number;
  temperatureCelsius: number;
  signalStrengthDbm: number;
  velocityMetersPerSecond: number;
  headingDegrees: number;
  requestId?: string;
}

export interface IngestTelemetryResult {
  telemetryId: string;
  robotId: string;
  recordedAt: Date;
  receivedAt: Date;
  status: 'ACCEPTED';
}

function observationMatches(
  existing: RobotTelemetry,
  incoming: IngestTelemetryInput,
): boolean {
  return (
    existing.schemaVersion === incoming.schemaVersion &&
    existing.recordedAt.getTime() === incoming.recordedAt.getTime() &&
    existing.position.x === incoming.position.x &&
    existing.position.y === incoming.position.y &&
    existing.position.z === incoming.position.z &&
    existing.batteryPercent === incoming.batteryPercent &&
    existing.temperatureCelsius === incoming.temperatureCelsius &&
    existing.signalStrengthDbm === incoming.signalStrengthDbm &&
    existing.velocityMetersPerSecond === incoming.velocityMetersPerSecond &&
    existing.headingDegrees === incoming.headingDegrees
  );
}

export class IngestTelemetry {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly logger: Logger,
  ) {}

  async execute(input: IngestTelemetryInput): Promise<IngestTelemetryResult> {
    if (input.schemaVersion !== TELEMETRY_SCHEMA_VERSION_V1) {
      // Contracts layer should reject first; defense in depth.
      throw new Error(`Unsupported schemaVersion: ${input.schemaVersion}`);
    }

    const receivedAt = new Date();

    return this.unitOfWork.execute(async (repos) => {
      const exists = await repos.robots.exists(input.robotId);
      if (!exists) {
        throw new RobotNotFoundError(input.robotId);
      }

      const existing = await repos.telemetry.findByRobotIdAndSource(
        input.robotId,
        input.sourceTelemetryId,
      );

      if (existing) {
        if (!observationMatches(existing, input)) {
          throw new IdempotencyConflictError(
            input.robotId,
            input.sourceTelemetryId,
          );
        }

        this.logger.info('Telemetry idempotent replay', {
          requestId: input.requestId,
          robotId: input.robotId,
          operation: 'IngestTelemetry',
        });

        return {
          telemetryId: existing.id,
          robotId: existing.robotId,
          recordedAt: existing.recordedAt,
          receivedAt: existing.receivedAt,
          status: 'ACCEPTED' as const,
        };
      }

      const telemetry: RobotTelemetry = {
        id: `tel_${ulid()}`,
        robotId: input.robotId,
        sourceTelemetryId: input.sourceTelemetryId,
        schemaVersion: input.schemaVersion,
        position: input.position,
        batteryPercent: input.batteryPercent,
        temperatureCelsius: input.temperatureCelsius,
        signalStrengthDbm: input.signalStrengthDbm,
        velocityMetersPerSecond: input.velocityMetersPerSecond,
        headingDegrees: input.headingDegrees,
        recordedAt: input.recordedAt,
        receivedAt,
      };

      const currentState: RobotCurrentState = {
        robotId: input.robotId,
        position: input.position,
        batteryPercent: input.batteryPercent,
        temperatureCelsius: input.temperatureCelsius,
        signalStrengthDbm: input.signalStrengthDbm,
        velocityMetersPerSecond: input.velocityMetersPerSecond,
        headingDegrees: input.headingDegrees,
        recordedAt: input.recordedAt,
        receivedAt,
      };

      await repos.telemetry.append(telemetry);
      await repos.currentState.updateIfNewer(currentState);

      this.logger.info('Telemetry accepted', {
        requestId: input.requestId,
        robotId: input.robotId,
        operation: 'IngestTelemetry',
      });

      return {
        telemetryId: telemetry.id,
        robotId: telemetry.robotId,
        recordedAt: telemetry.recordedAt,
        receivedAt: telemetry.receivedAt,
        status: 'ACCEPTED' as const,
      };
    });
  }
}
