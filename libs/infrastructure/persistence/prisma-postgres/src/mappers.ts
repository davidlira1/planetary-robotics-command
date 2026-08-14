import {
  Robot,
  RobotCurrentState,
  RobotOperationalStatus,
  RobotTelemetry,
  RobotType,
} from '@prc/domain';
import {
  Robot as PrismaRobot,
  RobotCurrentState as PrismaCurrentState,
  RobotTelemetry as PrismaTelemetry,
} from '@prisma/client';

export function toDomainRobot(row: PrismaRobot): Robot {
  return {
    id: row.id,
    displayName: row.displayName,
    type: row.type as RobotType,
    model: row.model,
    operationalStatus: row.operationalStatus as RobotOperationalStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toDomainCurrentState(row: PrismaCurrentState): RobotCurrentState {
  return {
    robotId: row.robotId,
    position: {
      x: row.positionX,
      y: row.positionY,
      z: row.positionZ,
    },
    batteryPercent: row.batteryPercent,
    temperatureCelsius: row.temperatureCelsius,
    signalStrengthDbm: row.signalStrengthDbm,
    velocityMetersPerSecond: row.velocityMetersPerSecond,
    headingDegrees: row.headingDegrees,
    recordedAt: row.recordedAt,
    receivedAt: row.receivedAt,
  };
}

export function toDomainTelemetry(row: PrismaTelemetry): RobotTelemetry {
  return {
    id: row.id,
    robotId: row.robotId,
    sourceTelemetryId: row.sourceTelemetryId,
    schemaVersion: row.schemaVersion,
    position: {
      x: row.positionX,
      y: row.positionY,
      z: row.positionZ,
    },
    batteryPercent: row.batteryPercent,
    temperatureCelsius: row.temperatureCelsius,
    signalStrengthDbm: row.signalStrengthDbm,
    velocityMetersPerSecond: row.velocityMetersPerSecond,
    headingDegrees: row.headingDegrees,
    recordedAt: row.recordedAt,
    receivedAt: row.receivedAt,
  };
}
