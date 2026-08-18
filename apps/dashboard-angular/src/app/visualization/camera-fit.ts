import { boundingSphereRadius, calculatePositionBounds, type FleetBounds, type Vec3 } from './fleet-bounds';

/** Presentation margin: ~10% of the viewport (8–12% target). */
export const FIT_PADDING = 1.1;
export const MARKER_RADIUS = 7;
export const INSPECTION_MARKER_RADIUS = 10;
export const MIN_FLEET_OVERVIEW_DISTANCE = 64;
export const MIN_INSPECTION_DISTANCE = 32;
export const NEAR_MARGIN = 2;
/** Kept for the unused AABB helper; production fit no longer floors to this span. */
export const MIN_FIT_SPAN = 80;
export const INSPECTION_SPAN = 48;
export const DEFAULT_VIEW_OFFSET: Vec3 = { x: 80, y: 70, z: 110 };

const WORLD_UP: Vec3 = { x: 0, y: 1, z: 0 };
const BASIS_EPSILON = 1e-6;

export interface TightFitOptions {
  padding?: number;
  markerRadius?: number;
  minDistance?: number;
  nearMargin?: number;
}

export function normalizeDirection(direction: Vec3): Vec3 {
  const length = Math.hypot(direction.x, direction.y, direction.z);
  if (length < 1e-6) {
    return normalizeDirection(DEFAULT_VIEW_OFFSET);
  }
  return { x: direction.x / length, y: direction.y / length, z: direction.z / length };
}

export function paddedSpan(span: number, padding = FIT_PADDING, minSpan = MIN_FIT_SPAN): number {
  return Math.max(span * padding, minSpan);
}

export function fitDistance(span: number, fovYRadians: number, aspect: number): number {
  const half = Math.max(span, 0) / 2;
  const safeAspect = Math.max(aspect, 0.001);
  const fovX = 2 * Math.atan(Math.tan(fovYRadians / 2) * safeAspect);
  const vertical = half / Math.tan(fovYRadians / 2);
  const horizontal = half / Math.tan(fovX / 2);
  return Math.max(vertical, horizontal);
}

export function horizontalFovRadians(fovYRadians: number, aspect: number): number {
  return 2 * Math.atan(Math.tan(fovYRadians / 2) * Math.max(aspect, 0.001));
}

export function sphereFitDistance(
  radius: number,
  fovYRadians: number,
  aspect: number,
  padding = FIT_PADDING,
): number {
  const safeRadius = Math.max(radius, 0);
  const fovX = horizontalFovRadians(fovYRadians, aspect);
  const halfMinFov = Math.min(fovYRadians, fovX) / 2;
  return (safeRadius * padding) / Math.sin(halfMinFov);
}

export function fleetFitDistance(bounds: FleetBounds, fovYRadians: number, aspect: number): number {
  return sphereFitDistance(boundingSphereRadius(bounds), fovYRadians, aspect);
}

export function cameraPositionFromTarget(target: Vec3, direction: Vec3, distance: number): Vec3 {
  const unit = normalizeDirection(direction);
  return {
    x: target.x + unit.x * distance,
    y: target.y + unit.y * distance,
    z: target.z + unit.z * distance,
  };
}

export function inspectionBounds(center: Vec3, span = INSPECTION_SPAN): FleetBounds {
  const half = span / 2;
  return {
    min: { x: center.x - half, y: center.y - half * 0.5, z: center.z - half },
    max: { x: center.x + half, y: center.y + half * 0.5, z: center.z + half },
    center,
    width: span,
    height: span * 0.5,
    depth: span,
    horizontalSpan: span,
  };
}

/**
 * Minimum camera distance along `viewDirection` (target → camera) such that every
 * point sits inside both the vertical and horizontal perspective frustums.
 */
export function calculateTightFleetCameraDistance(
  positions: readonly Vec3[],
  viewDirection: Vec3,
  verticalFovRadians: number,
  aspect: number,
  options: TightFitOptions = {},
): number {
  const padding = options.padding ?? FIT_PADDING;
  const markerRadius = options.markerRadius ?? MARKER_RADIUS;
  const minDistance = options.minDistance ?? MIN_FLEET_OVERVIEW_DISTANCE;
  const nearMargin = options.nearMargin ?? NEAR_MARGIN;

  const look = normalizeDirection(viewDirection);
  const rightRaw = cross(WORLD_UP, look);
  const rightLength = Math.hypot(rightRaw.x, rightRaw.y, rightRaw.z);
  if (rightLength < BASIS_EPSILON) {
    return sphereFallback(positions, markerRadius, verticalFovRadians, aspect, padding, minDistance);
  }
  const right = {
    x: rightRaw.x / rightLength,
    y: rightRaw.y / rightLength,
    z: rightRaw.z / rightLength,
  };
  const up = cross(look, right);

  const center = calculatePositionBounds(positions)?.center ?? { x: 0, y: 0, z: 0 };
  const fovX = horizontalFovRadians(verticalFovRadians, aspect);
  const tanX = Math.tan(fovX / 2);
  const tanY = Math.tan(verticalFovRadians / 2);

  let required = 0;
  for (const position of positions) {
    const offsetX = position.x - center.x;
    const offsetY = position.y - center.y;
    const offsetZ = position.z - center.z;
    const alongLook = offsetX * look.x + offsetY * look.y + offsetZ * look.z;
    const alongRight = offsetX * right.x + offsetY * right.y + offsetZ * right.z;
    const alongUp = offsetX * up.x + offsetY * up.y + offsetZ * up.z;
    required = Math.max(
      required,
      alongLook + (Math.abs(alongRight) + markerRadius) / tanX,
      alongLook + (Math.abs(alongUp) + markerRadius) / tanY,
      alongLook + markerRadius + nearMargin,
    );
  }

  return Math.max(minDistance, required * padding);
}

function sphereFallback(
  positions: readonly Vec3[],
  markerRadius: number,
  verticalFovRadians: number,
  aspect: number,
  padding: number,
  minDistance: number,
): number {
  const bounds = calculatePositionBounds(positions);
  const radius = Math.max(bounds ? boundingSphereRadius(bounds) : 0, markerRadius);
  return Math.max(minDistance, sphereFitDistance(radius, verticalFovRadians, aspect, padding));
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}
