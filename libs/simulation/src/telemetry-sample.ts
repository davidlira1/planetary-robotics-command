import { TELEMETRY_SCHEMA_VERSION_V1 } from '@prc/domain';
import { TelemetrySample } from '@prc/ports';
import { SimulatedRobot } from './fleet';

function sanitizeRobotIdForSource(robotId: string): string {
  return robotId.replace(/[^A-Za-z0-9]/g, '');
}

export function buildSourceTelemetryId(
  robotId: string,
  uniquePart: string,
): string {
  return `sim_${sanitizeRobotIdForSource(robotId)}_${uniquePart}`;
}

/**
 * Immutable snapshot of current simulated state for one outgoing sample.
 * Retries must reuse this object; do not rebuild from later robot state.
 */
export function snapshotTelemetrySample(
  robot: SimulatedRobot,
  recordedAt: Date,
  uniqueIdPart: string,
): TelemetrySample {
  const speed = Math.sqrt(
    robot.velocity.x ** 2 + robot.velocity.y ** 2 + robot.velocity.z ** 2,
  );

  const sample: TelemetrySample = Object.freeze({
    sourceTelemetryId: buildSourceTelemetryId(robot.robotId, uniqueIdPart),
    robotId: robot.robotId,
    schemaVersion: TELEMETRY_SCHEMA_VERSION_V1,
    recordedAt: new Date(recordedAt.getTime()),
    position: Object.freeze({
      x: robot.position.x,
      y: robot.position.y,
      z: robot.position.z,
    }),
    batteryPercent: robot.batteryPercent,
    temperatureCelsius: robot.temperatureCelsius,
    signalStrengthDbm: robot.signalStrengthDbm,
    velocityMetersPerSecond: speed,
    headingDegrees: robot.headingDegrees,
  });

  return sample;
}
