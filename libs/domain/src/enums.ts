export enum RobotType {
  SCOUT = 'SCOUT',
  DRONE = 'DRONE',
  HAULER = 'HAULER',
  WORKER = 'WORKER',
  MINER = 'MINER',
}

/**
 * What the robot is operationally doing.
 * Distinct from a future telemetry-derived RobotHealthStatus
 * (HEALTHY | WARNING | CRITICAL) — do not conflate.
 */
export enum RobotOperationalStatus {
  OFFLINE = 'OFFLINE',
  IDLE = 'IDLE',
  ACTIVE = 'ACTIVE',
  CHARGING = 'CHARGING',
  FAULTED = 'FAULTED',
}

/** Layer 1 supported telemetry schema version. */
export const TELEMETRY_SCHEMA_VERSION_V1 = 1;
