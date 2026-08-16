import type { RobotWorldRobot } from './robot-world';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface FleetBounds {
  min: Vec3;
  max: Vec3;
  center: Vec3;
  width: number;
  height: number;
  depth: number;
  horizontalSpan: number;
}

export function calculatePositionBounds(positions: readonly Vec3[]): FleetBounds | null {
  if (positions.length === 0) {
    return null;
  }
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const position of positions) {
    minX = Math.min(minX, position.x);
    minY = Math.min(minY, position.y);
    minZ = Math.min(minZ, position.z);
    maxX = Math.max(maxX, position.x);
    maxY = Math.max(maxY, position.y);
    maxZ = Math.max(maxZ, position.z);
  }
  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 },
    width: maxX - minX,
    height: maxY - minY,
    depth: maxZ - minZ,
    horizontalSpan: Math.max(maxX - minX, maxZ - minZ),
  };
}

/** Half the AABB diagonal. Robust for oblique camera framing. */
export function boundingSphereRadius(bounds: FleetBounds): number {
  return 0.5 * Math.hypot(bounds.width, bounds.height, bounds.depth);
}

export function calculateFleetBounds(robots: readonly RobotWorldRobot[]): FleetBounds | null {
  const positions: Vec3[] = [];
  for (const robot of robots) {
    if (robot.position) {
      positions.push(robot.position);
    }
  }
  return calculatePositionBounds(positions);
}
