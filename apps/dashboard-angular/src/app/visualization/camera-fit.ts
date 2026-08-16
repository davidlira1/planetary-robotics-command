import { boundingSphereRadius, type FleetBounds, type Vec3 } from './fleet-bounds';

export const FIT_PADDING = 1.35;
export const MIN_FIT_SPAN = 80;
export const INSPECTION_SPAN = 48;
export const DEFAULT_VIEW_OFFSET: Vec3 = { x: 80, y: 70, z: 110 };

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
  const safeRadius = Math.max(radius, MIN_FIT_SPAN / 2);
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
