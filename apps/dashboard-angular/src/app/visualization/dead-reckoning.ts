import { headingToGroundDirection } from './heading';
import type { Vec3 } from './fleet-bounds';

/** Covers the default 1 Hz telemetry gap without driving a stale sample forever. */
export const PREDICTION_HORIZON_SECONDS = 1.25;

export function predictGroundOffset(
  velocityMetersPerSecond: number,
  headingDegrees: number,
  elapsedSeconds: number,
  horizonSeconds = PREDICTION_HORIZON_SECONDS,
): Vec3 {
  const t = Math.min(Math.max(elapsedSeconds, 0), horizonSeconds);
  if (velocityMetersPerSecond <= 0 || t === 0) {
    return { x: 0, y: 0, z: 0 };
  }
  const direction = headingToGroundDirection(headingDegrees);
  const distance = velocityMetersPerSecond * t;
  return { x: direction.x * distance, y: 0, z: direction.z * distance };
}

export function predictedPosition(
  authoritative: Vec3,
  velocityMetersPerSecond: number,
  headingDegrees: number,
  elapsedSeconds: number,
  horizonSeconds = PREDICTION_HORIZON_SECONDS,
): Vec3 {
  const offset = predictGroundOffset(
    velocityMetersPerSecond,
    headingDegrees,
    elapsedSeconds,
    horizonSeconds,
  );
  return {
    x: authoritative.x + offset.x,
    y: authoritative.y,
    z: authoritative.z + offset.z,
  };
}
