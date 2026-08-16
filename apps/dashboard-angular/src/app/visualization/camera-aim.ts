import type { Vec3 } from './fleet-bounds';

export interface AimableCamera {
  position: Vec3;
  lookAt(x: number, y: number, z: number): void;
  updateMatrixWorld?(force?: boolean): void;
}

export interface AimableControls {
  target: Vec3;
}

/** Apply a fitted pose. Runtime framing writes position/target and lets OrbitControls lookAt. */
export function aimCamera(
  camera: AimableCamera,
  controls: AimableControls,
  position: Vec3,
  target: Vec3,
): void {
  camera.position.x = position.x;
  camera.position.y = position.y;
  camera.position.z = position.z;
  controls.target.x = target.x;
  controls.target.y = target.y;
  controls.target.z = target.z;
  camera.lookAt(target.x, target.y, target.z);
  camera.updateMatrixWorld?.(true);
}
