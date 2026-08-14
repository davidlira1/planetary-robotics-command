import {
  Alert,
  AlertSeverity,
  AlertStatus,
  AlertType,
  HEALTH_THRESHOLDS,
  HealthDimensionStatus,
  RobotHealthState,
  RobotHealthStatus,
} from '@prc/domain';
import {
  RobotTelemetryReceivedEventV1,
  RobotTelemetryReceivedEventV1Schema,
} from '@prc/contracts';
import { Logger, UnitOfWork } from '@prc/ports';
import { ulid } from 'ulid';

export const HEALTH_WORKER_CONSUMER = 'health-worker';

export type EvaluateRobotHealthResult =
  | { status: 'processed' }
  | { status: 'duplicate' }
  | { status: 'stale' };

function classifyBattery(percent: number): HealthDimensionStatus {
  if (percent < HEALTH_THRESHOLDS.battery.criticalBelow) {
    return HealthDimensionStatus.CRITICAL;
  }
  if (percent < HEALTH_THRESHOLDS.battery.warningBelow) {
    return HealthDimensionStatus.WARNING;
  }
  return HealthDimensionStatus.NORMAL;
}

function classifyTemperature(celsius: number): HealthDimensionStatus {
  if (celsius > HEALTH_THRESHOLDS.temperature.criticalAbove) {
    return HealthDimensionStatus.CRITICAL;
  }
  if (celsius > HEALTH_THRESHOLDS.temperature.warningAbove) {
    return HealthDimensionStatus.WARNING;
  }
  return HealthDimensionStatus.NORMAL;
}

function classifySignal(dbm: number): HealthDimensionStatus {
  if (dbm < HEALTH_THRESHOLDS.signal.criticalBelowDbm) {
    return HealthDimensionStatus.CRITICAL;
  }
  if (dbm < HEALTH_THRESHOLDS.signal.warningBelowDbm) {
    return HealthDimensionStatus.WARNING;
  }
  return HealthDimensionStatus.NORMAL;
}

function overallStatus(
  battery: HealthDimensionStatus,
  temperature: HealthDimensionStatus,
  signal: HealthDimensionStatus,
): RobotHealthStatus {
  const dims = [battery, temperature, signal];
  if (dims.includes(HealthDimensionStatus.CRITICAL)) {
    return RobotHealthStatus.CRITICAL;
  }
  if (dims.includes(HealthDimensionStatus.WARNING)) {
    return RobotHealthStatus.WARNING;
  }
  return RobotHealthStatus.HEALTHY;
}

function transitionAlert(
  type: AlertType,
  previous: HealthDimensionStatus | undefined,
  next: HealthDimensionStatus,
  robotId: string,
  sourceTelemetryId: string,
  sourceEventId: string,
  detail: string,
): Alert | null {
  const escalated =
    next === HealthDimensionStatus.CRITICAL &&
    previous !== HealthDimensionStatus.CRITICAL;
  const enteredWarning =
    next === HealthDimensionStatus.WARNING &&
    previous !== HealthDimensionStatus.WARNING &&
    previous !== HealthDimensionStatus.CRITICAL;

  if (!escalated && !enteredWarning) return null;

  const severity =
    next === HealthDimensionStatus.CRITICAL
      ? AlertSeverity.CRITICAL
      : AlertSeverity.WARNING;

  return {
    id: `alrt_${ulid()}`,
    robotId,
    type,
    severity,
    status: AlertStatus.OPEN,
    title: `${type} ${severity}`,
    message: detail,
    sourceTelemetryId,
    sourceEventId,
    createdAt: new Date(),
    acknowledgedAt: null,
    acknowledgedBy: null,
  };
}

export class EvaluateRobotHealth {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly logger: Logger,
  ) {}

  async execute(rawEvent: unknown): Promise<EvaluateRobotHealthResult> {
    const event: RobotTelemetryReceivedEventV1 =
      RobotTelemetryReceivedEventV1Schema.parse(rawEvent);
    const payload = event.payload;
    const recordedAt = new Date(payload.recordedAt);

    return this.unitOfWork.execute(async (repos) => {
      const ownership = await repos.processedMessages.tryBeginProcessing(
        HEALTH_WORKER_CONSUMER,
        event.eventId,
      );
      if (!ownership.acquired) {
        this.logger.info('Duplicate health event ignored', {
          eventId: event.eventId,
          correlationId: event.correlationId,
          robotId: payload.robotId,
          operation: 'EvaluateRobotHealth',
        });
        return { status: 'duplicate' as const };
      }

      // Serialize all health evaluations for this robot, including first-ever
      // evaluations when RobotHealthState does not yet exist.
      await repos.robots.lockById(payload.robotId);

      const existing = await repos.health.findByRobotIdForUpdate(payload.robotId);

      if (
        existing &&
        recordedAt.getTime() <= existing.evaluatedFromRecordedAt.getTime()
      ) {
        this.logger.info('Stale/equal telemetry skipped for health', {
          eventId: event.eventId,
          correlationId: event.correlationId,
          robotId: payload.robotId,
          operation: 'EvaluateRobotHealth',
        });
        return { status: 'stale' as const };
      }

      const batteryStatus = classifyBattery(payload.batteryPercent);
      const temperatureStatus = classifyTemperature(payload.temperatureCelsius);
      const signalStatus = classifySignal(payload.signalStrengthDbm);
      const status = overallStatus(
        batteryStatus,
        temperatureStatus,
        signalStatus,
      );

      const nextState: RobotHealthState = {
        robotId: payload.robotId,
        status,
        batteryStatus,
        temperatureStatus,
        signalStatus,
        evaluatedFromTelemetryId: payload.telemetryId,
        evaluatedFromRecordedAt: recordedAt,
        updatedAt: new Date(),
      };

      const alerts = [
        transitionAlert(
          AlertType.LOW_BATTERY,
          existing?.batteryStatus,
          batteryStatus,
          payload.robotId,
          payload.sourceTelemetryId,
          event.eventId,
          `Battery ${payload.batteryPercent}%`,
        ),
        transitionAlert(
          AlertType.HIGH_TEMPERATURE,
          existing?.temperatureStatus,
          temperatureStatus,
          payload.robotId,
          payload.sourceTelemetryId,
          event.eventId,
          `Temperature ${payload.temperatureCelsius}C`,
        ),
        transitionAlert(
          AlertType.SIGNAL_DEGRADED,
          existing?.signalStatus,
          signalStatus,
          payload.robotId,
          payload.sourceTelemetryId,
          event.eventId,
          `Signal ${payload.signalStrengthDbm} dBm`,
        ),
      ].filter((a): a is Alert => a !== null);

      await repos.health.updateIfNewer(nextState);
      for (const alert of alerts) {
        await repos.alerts.append(alert);
      }

      this.logger.info('Health evaluated', {
        eventId: event.eventId,
        correlationId: event.correlationId,
        robotId: payload.robotId,
        operation: 'EvaluateRobotHealth',
        healthStatus: status,
        alertCount: alerts.length,
      });

      return { status: 'processed' as const };
    });
  }
}

export {
  classifyBattery,
  classifyTemperature,
  classifySignal,
  overallStatus,
};
