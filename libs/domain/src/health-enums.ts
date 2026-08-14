export enum RobotHealthStatus {
  HEALTHY = 'HEALTHY',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export enum HealthDimensionStatus {
  NORMAL = 'NORMAL',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export enum AlertSeverity {
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export enum AlertStatus {
  OPEN = 'OPEN',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
}

export enum AlertType {
  LOW_BATTERY = 'LOW_BATTERY',
  HIGH_TEMPERATURE = 'HIGH_TEMPERATURE',
  SIGNAL_DEGRADED = 'SIGNAL_DEGRADED',
}
