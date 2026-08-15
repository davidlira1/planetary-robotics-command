/**
 * World coordinate conventions (Three.js-friendly later):
 * - x = east/west
 * - y = altitude (vertical)
 * - z = north/south
 *
 * Ground robots keep y ≈ 0. Drones operate with y > 0.
 * Units are meters within a Cartesian local frame (no lat/lon).
 */

export interface WorldBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  maxAltitude: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const DEFAULT_WORLD_BOUNDS: WorldBounds = {
  minX: -1000,
  maxX: 1000,
  minZ: -1000,
  maxZ: 1000,
  maxAltitude: 300,
};

export const DEFAULT_BASE_STATION: Vec3 = { x: 0, y: 0, z: 0 };

/** Maximum physics step (seconds) to avoid teleports after stalls. */
export const MAX_DELTA_SECONDS = 0.5;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampDeltaSeconds(dt: number): number {
  if (!Number.isFinite(dt) || dt < 0) return 0;
  return Math.min(dt, MAX_DELTA_SECONDS);
}

export function distance3(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function normalizeHeading(degrees: number): number {
  let h = degrees % 360;
  if (h < 0) h += 360;
  return h;
}
