import { exponentialSmoothingAlpha } from './exponential-smoothing';
import type { Vec3 } from './fleet-bounds';
import { headingToGroundDirection, lerpHeadingDegrees } from './heading';

export const CHASE_DISTANCE = 30;
export const CHASE_HEIGHT = 14;
export const LOOK_AHEAD = 10;
export const CHASE_TARGET_HEIGHT = 3.5;
/** Meters — desired chase pose moves with the robot, so this is looser than SETTLE_EPSILON. */
export const CHASE_APPROACH_TOLERANCE = 8;
/** Same order of magnitude as CAMERA_SMOOTHING so the ease reads as one move. */
export const CHASE_APPROACH_SMOOTHING = 4;
export const CHASE_HEADING_SMOOTHING = 3;

export interface FollowCameraLike {
  position: Vec3;
}

export interface ChaseSubject {
  position: Vec3;
  headingDegrees: number;
}

export interface ChasePose {
  position: Vec3;
  target: Vec3;
}

export function chasePose(robotPosition: Vec3, headingDegrees: number): ChasePose {
  const forward = headingToGroundDirection(headingDegrees);
  return {
    position: {
      x: robotPosition.x - forward.x * CHASE_DISTANCE,
      y: robotPosition.y + CHASE_HEIGHT,
      z: robotPosition.z - forward.z * CHASE_DISTANCE,
    },
    target: {
      x: robotPosition.x + forward.x * LOOK_AHEAD,
      y: robotPosition.y + CHASE_TARGET_HEIGHT,
      z: robotPosition.z + forward.z * LOOK_AHEAD,
    },
  };
}

export function chasePoseError(
  cameraPosition: Vec3,
  controlsTarget: Vec3,
  pose: ChasePose,
): number {
  return Math.max(vecDistance(cameraPosition, pose.position), vecDistance(controlsTarget, pose.target));
}

export function applyChasePose(
  camera: FollowCameraLike,
  controlsTarget: Vec3,
  pose: ChasePose,
): void {
  copyVec(camera.position, pose.position);
  copyVec(controlsTarget, pose.target);
}

export class CameraFollowSession {
  followedRobotId: string | null = null;
  approachingChase = false;
  smoothedHeading: number | null = null;
  private lastDesired: ChasePose | null = null;

  beginFocus(robotId: string, subject: ChaseSubject | null): void {
    this.cancel();
    if (!subject) {
      return;
    }
    this.followedRobotId = robotId;
    this.approachingChase = true;
    this.smoothedHeading = subject.headingDegrees;
    this.lastDesired = clonePose(chasePose(subject.position, subject.headingDegrees));
  }

  cancel(): void {
    this.followedRobotId = null;
    this.approachingChase = false;
    this.smoothedHeading = null;
    this.lastDesired = null;
  }

  get chasing(): boolean {
    return this.followedRobotId != null && !this.approachingChase;
  }

  tick(
    deltaSeconds: number,
    camera: FollowCameraLike,
    controlsTarget: Vec3,
    subject: ChaseSubject | null,
  ): void {
    if (!this.followedRobotId) {
      return;
    }
    if (!subject) {
      this.cancel();
      return;
    }

    const headingAlpha = exponentialSmoothingAlpha(CHASE_HEADING_SMOOTHING, deltaSeconds);
    this.smoothedHeading = lerpHeadingDegrees(
      this.smoothedHeading ?? subject.headingDegrees,
      subject.headingDegrees,
      headingAlpha,
    );
    const desired = chasePose(subject.position, this.smoothedHeading);
    const approachAlpha = exponentialSmoothingAlpha(CHASE_APPROACH_SMOOTHING, deltaSeconds);

    if (this.approachingChase) {
      lerpVec(camera.position, desired.position, approachAlpha);
      lerpVec(controlsTarget, desired.target, approachAlpha);
      if (chasePoseError(camera.position, controlsTarget, desired) <= CHASE_APPROACH_TOLERANCE) {
        this.approachingChase = false;
      }
    } else {
      if (this.lastDesired) {
        addDelta(camera.position, desired.position, this.lastDesired.position);
        addDelta(controlsTarget, desired.target, this.lastDesired.target);
      }
      lerpVec(camera.position, desired.position, approachAlpha);
      lerpVec(controlsTarget, desired.target, approachAlpha);
    }

    this.lastDesired = clonePose(desired);
  }
}

function clonePose(pose: ChasePose): ChasePose {
  return {
    position: { ...pose.position },
    target: { ...pose.target },
  };
}

function copyVec(target: Vec3, source: Vec3): void {
  target.x = source.x;
  target.y = source.y;
  target.z = source.z;
}

function addDelta(current: Vec3, next: Vec3, previous: Vec3): void {
  current.x += next.x - previous.x;
  current.y += next.y - previous.y;
  current.z += next.z - previous.z;
}

function lerpVec(current: Vec3, desired: Vec3, alpha: number): void {
  current.x += (desired.x - current.x) * alpha;
  current.y += (desired.y - current.y) * alpha;
  current.z += (desired.z - current.z) * alpha;
}

function vecDistance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
