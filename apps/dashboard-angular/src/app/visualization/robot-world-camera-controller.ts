import { exponentialSmoothingAlpha } from './exponential-smoothing';
import type { Vec3 } from './fleet-bounds';

/** Slower than robot POSITION_SMOOTHING so framing reads as a deliberate move. */
export const CAMERA_SMOOTHING = 4;
const SETTLE_EPSILON = 0.08;

export interface CameraLike {
  position: Vec3;
}

export interface ControlsLike {
  target: Vec3;
}

export class RobotWorldCameraController {
  readonly desiredPosition: Vec3 = { x: 0, y: 0, z: 0 };
  readonly desiredTarget: Vec3 = { x: 0, y: 0, z: 0 };
  active = false;

  begin(position: Vec3, target: Vec3): void {
    copyVec(this.desiredPosition, position);
    copyVec(this.desiredTarget, target);
    this.active = true;
  }

  snap(camera: CameraLike, controls: ControlsLike, position: Vec3, target: Vec3): void {
    this.begin(position, target);
    copyVec(camera.position, position);
    copyVec(controls.target, target);
    this.active = false;
  }

  tick(deltaSeconds: number, camera: CameraLike, controls: ControlsLike): void {
    if (!this.active) {
      return;
    }
    const alpha = exponentialSmoothingAlpha(CAMERA_SMOOTHING, deltaSeconds);
    lerpVec(camera.position, this.desiredPosition, alpha);
    copyVec(controls.target, this.desiredTarget);
    if (remainingError(camera.position, this.desiredPosition) < SETTLE_EPSILON) {
      copyVec(camera.position, this.desiredPosition);
      copyVec(controls.target, this.desiredTarget);
      this.active = false;
    }
  }
}

function copyVec(target: Vec3, source: Vec3): void {
  target.x = source.x;
  target.y = source.y;
  target.z = source.z;
}

function lerpVec(current: Vec3, desired: Vec3, alpha: number): void {
  current.x += (desired.x - current.x) * alpha;
  current.y += (desired.y - current.y) * alpha;
  current.z += (desired.z - current.z) * alpha;
}

function remainingError(current: Vec3, desired: Vec3): number {
  return Math.hypot(desired.x - current.x, desired.y - current.y, desired.z - current.z);
}
