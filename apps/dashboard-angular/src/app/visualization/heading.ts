/** Simulator heading: 0° = +Z (north), 90° = +X (east), clockwise from above. */
export function headingToGroundDirection(headingDegrees: number): { x: number; z: number } {
  const radians = (headingDegrees * Math.PI) / 180;
  return { x: Math.sin(radians), z: Math.cos(radians) };
}

export function normalizeHeadingDegrees(headingDegrees: number): number {
  return ((headingDegrees % 360) + 360) % 360;
}

/** Shortest-path interpolation on a 0–360 circle. */
export function lerpHeadingDegrees(current: number, target: number, alpha: number): number {
  const delta = ((target - current + 540) % 360) - 180;
  return normalizeHeadingDegrees(current + delta * alpha);
}
