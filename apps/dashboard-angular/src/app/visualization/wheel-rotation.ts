/** Positive rotation.x on a PI/2-Z-rolled cylinder (axle along +X) rolls the hull toward +Z. */
export const WHEEL_FORWARD_SIGN = 1;

export function wheelRotationRadians(distanceMoved: number, wheelRadius: number): number {
  if (!(wheelRadius > 0) || !Number.isFinite(distanceMoved) || Math.abs(distanceMoved) < 1e-9) {
    return 0;
  }
  return (distanceMoved / wheelRadius) * WHEEL_FORWARD_SIGN;
}
