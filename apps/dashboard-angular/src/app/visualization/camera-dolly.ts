import { cameraPositionFromTarget, normalizeDirection } from './camera-fit';
import type { Vec3 } from './fleet-bounds';

export interface DollyInspectionPose {
  position: Vec3;
  target: Vec3;
  direction: Vec3;
}

/** Camera stays on the current camera→robot ray and dollies to `inspectionDistance`. */
export function dollyInspectionPose(
  cameraPosition: Vec3,
  robotPosition: Vec3,
  inspectionDistance: number,
): DollyInspectionPose {
  const direction = normalizeDirection({
    x: cameraPosition.x - robotPosition.x,
    y: cameraPosition.y - robotPosition.y,
    z: cameraPosition.z - robotPosition.z,
  });
  return {
    target: { x: robotPosition.x, y: robotPosition.y, z: robotPosition.z },
    direction,
    position: cameraPositionFromTarget(robotPosition, direction, inspectionDistance),
  };
}
