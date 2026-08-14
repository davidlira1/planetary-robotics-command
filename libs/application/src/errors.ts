export class ApplicationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class RobotNotFoundError extends ApplicationError {
  constructor(robotId: string) {
    super(`Robot ${robotId} does not exist.`, 'ROBOT_NOT_FOUND');
  }
}

export class IdempotencyConflictError extends ApplicationError {
  constructor(robotId: string, sourceTelemetryId: string) {
    super(
      `Conflicting telemetry for robot ${robotId} with sourceTelemetryId ${sourceTelemetryId}.`,
      'IDEMPOTENCY_CONFLICT',
    );
  }
}

export class InvalidCursorError extends ApplicationError {
  constructor(message = 'Invalid cursor.') {
    super(message, 'INVALID_CURSOR');
  }
}

export class InvalidTimeRangeError extends ApplicationError {
  constructor(message = 'Invalid time range: from must be <= to.') {
    super(message, 'INVALID_TIME_RANGE');
  }
}
