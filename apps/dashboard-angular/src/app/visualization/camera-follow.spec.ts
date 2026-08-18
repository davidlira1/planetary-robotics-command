import {
  applyChasePose,
  CameraFollowSession,
  CHASE_APPROACH_TOLERANCE,
  CHASE_DISTANCE,
  CHASE_HEIGHT,
  CHASE_TARGET_HEIGHT,
  chasePose,
  chasePoseError,
  LOOK_AHEAD,
} from './camera-follow';
import { headingToGroundDirection } from './heading';
import type { Vec3 } from './fleet-bounds';

function vec(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

function copy(v: Vec3): Vec3 {
  return { x: v.x, y: v.y, z: v.z };
}

describe('chasePose', () => {
  const robot = vec(10, 2, 4);

  it('places the camera behind the robot using heading 0 = +Z', () => {
    const forward = headingToGroundDirection(0);
    expect(forward).toEqual({ x: 0, z: 1 });
    const pose = chasePose(robot, 0);
    expect(pose.position.x).toBeCloseTo(robot.x);
    expect(pose.position.y).toBeCloseTo(robot.y + CHASE_HEIGHT);
    expect(pose.position.z).toBeCloseTo(robot.z - CHASE_DISTANCE);
    expect(pose.position.z).toBeLessThan(robot.z);
  });

  it('includes configured height and look-ahead on the target', () => {
    const pose = chasePose(robot, 0);
    expect(pose.position.y - robot.y).toBeCloseTo(CHASE_HEIGHT);
    expect(pose.target.x).toBeCloseTo(robot.x);
    expect(pose.target.y).toBeCloseTo(robot.y + CHASE_TARGET_HEIGHT);
    expect(pose.target.z).toBeCloseTo(robot.z + LOOK_AHEAD);
  });

  it('moves the behind vector when heading changes', () => {
    const north = chasePose(robot, 0);
    const east = chasePose(robot, 90);
    expect(east.position.x).toBeCloseTo(robot.x - CHASE_DISTANCE);
    expect(east.position.z).toBeCloseTo(robot.z);
    expect(east.position.x).not.toBeCloseTo(north.position.x);
  });
});

describe('CameraFollowSession', () => {
  const d04 = { position: vec(10, 1, 4), headingDegrees: 0 };
  const h17 = { position: vec(40, 0, 8), headingDegrees: 90 };
  const dt = 0.016;

  it('starts approach from the current camera pose without snapping', () => {
    const session = new CameraFollowSession();
    const startCamera = vec(200, 80, 180);
    const startTarget = vec(0, 0, 0);
    const camera = { position: { ...startCamera } };
    const target = { ...startTarget };

    session.beginFocus('D-04', d04);
    expect(session.followedRobotId).toBe('D-04');
    expect(session.approachingChase).toBe(true);
    expect(session.chasing).toBe(false);
    expect(camera.position).toEqual(startCamera);
    expect(target).toEqual(startTarget);

    session.tick(dt, camera, target, d04);
    const pose = chasePose(d04.position, 0);
    expect(session.approachingChase).toBe(true);
    expect(camera.position).not.toEqual(startCamera);
    expect(camera.position).not.toEqual(pose.position);
    expect(target).not.toEqual(startTarget);
    expect(target).not.toEqual(d04.position);
    expect(target).not.toEqual(pose.target);
    expect(vecDistance(camera.position, pose.position)).toBeLessThan(vecDistance(startCamera, pose.position));
    expect(vecDistance(target, pose.target)).toBeLessThan(vecDistance(startTarget, pose.target));
  });

  it('updates the approach toward the live chase pose as the robot translates', () => {
    const session = new CameraFollowSession();
    session.beginFocus('D-04', d04);
    const camera = { position: vec(200, 80, 180) };
    const target = vec(0, 0, 0);
    session.tick(dt, camera, target, d04);
    const afterFirst = copy(camera.position);

    const moved = { position: vec(40, 1, 4), headingDegrees: 0 };
    session.tick(dt, camera, target, moved);
    const live = chasePose(moved.position, 0);
    const stale = chasePose(d04.position, 0);
    expect(vecDistance(camera.position, live.position)).toBeLessThan(vecDistance(afterFirst, live.position));
    expect(vecDistance(camera.position, live.position)).toBeLessThan(vecDistance(camera.position, stale.position));
    expect(target.z).not.toBeCloseTo(moved.position.z);
  });

  it('enters chasing when close to the moving chase pose without teleporting', () => {
    const session = new CameraFollowSession();
    session.beginFocus('D-04', d04);
    const pose = chasePose(d04.position, d04.headingDegrees);
    const offset = CHASE_APPROACH_TOLERANCE * 0.4;
    const camera = {
      position: vec(pose.position.x + offset, pose.position.y, pose.position.z),
    };
    const target = { ...pose.target };
    session.tick(0, camera, target, d04);
    expect(session.chasing).toBe(true);
    expect(session.approachingChase).toBe(false);
    expect(camera.position.x).toBeCloseTo(pose.position.x + offset);
    expect(camera.position).not.toEqual(pose.position);
  });

  it('keeps camera and target continuous across the acquire handoff', () => {
    const session = new CameraFollowSession();
    session.beginFocus('D-04', d04);
    const pose = chasePose(d04.position, 0);
    const camera = { position: vec(pose.position.x + CHASE_APPROACH_TOLERANCE * 1.6, pose.position.y, pose.position.z) };
    const target = { ...pose.target };
    let lastCameraDelta = 0;
    let lastTargetDelta = 0;
    let acquired = false;

    for (let i = 0; i < 40; i += 1) {
      const beforeCamera = copy(camera.position);
      const beforeTarget = copy(target);
      const wasApproaching = session.approachingChase;
      session.tick(dt, camera, target, d04);
      const cameraDelta = vecDistance(camera.position, beforeCamera);
      const targetDelta = vecDistance(target, beforeTarget);
      if (wasApproaching && session.chasing) {
        lastCameraDelta = cameraDelta;
        lastTargetDelta = targetDelta;
        acquired = true;
        break;
      }
      lastCameraDelta = cameraDelta;
      lastTargetDelta = targetDelta;
    }
    expect(acquired).toBe(true);
    expect(session.chasing).toBe(true);

    const headingAtAcquire = session.smoothedHeading;
    const cameraAtAcquire = copy(camera.position);
    const targetAtAcquire = copy(target);
    const exact = chasePose(d04.position, session.smoothedHeading ?? 0);
    expect(vecDistance(camera.position, exact.position)).toBeGreaterThan(0.05);

    session.tick(dt, camera, target, d04);
    expect(vecDistance(camera.position, cameraAtAcquire)).toBeLessThanOrEqual(lastCameraDelta + 0.05);
    expect(vecDistance(target, targetAtAcquire)).toBeLessThanOrEqual(lastTargetDelta + 0.05);
    expect(session.smoothedHeading).toBe(headingAtAcquire);

    session.tick(dt, camera, target, { position: d04.position, headingDegrees: 90 });
    expect(session.smoothedHeading).not.toBe(90);
    expect(session.smoothedHeading).toBeGreaterThan(headingAtAcquire ?? 0);
  });

  it('stays approaching when still far from the live chase pose', () => {
    const session = new CameraFollowSession();
    session.beginFocus('D-04', d04);
    const camera = { position: vec(400, 80, 400) };
    const target = vec(0, 0, 0);
    session.tick(dt, camera, target, d04);
    expect(session.approachingChase).toBe(true);
    expect(session.chasing).toBe(false);
    expect(chasePoseError(camera.position, target, chasePose(d04.position, 0))).toBeGreaterThan(
      CHASE_APPROACH_TOLERANCE,
    );
  });

  it('locks translation to rendered position while heading change arcs the behind vector', () => {
    const session = new CameraFollowSession();
    session.beginFocus('D-04', d04);
    const start = chasePose(d04.position, 0);
    const camera = { position: { ...start.position } };
    const target = { ...start.target };
    applyChasePose(camera, target, start);
    session.approachingChase = false;
    session.smoothedHeading = 0;

    const translated = { position: vec(20, 1, 4), headingDegrees: 0 };
    session.tick(0, camera, target, translated);
    expect(camera.position.x - translated.position.x).toBeCloseTo(start.position.x - d04.position.x);
    expect(camera.position.z - translated.position.z).toBeCloseTo(start.position.z - d04.position.z);

    session.tick(10, camera, target, { position: translated.position, headingDegrees: 90 });
    expect(camera.position.x).toBeLessThan(translated.position.x);
    expect(camera.position.y).toBeCloseTo(translated.position.y + CHASE_HEIGHT);
  });

  it('clears chase on cancel so OrbitControls can take over from the current pose', () => {
    const session = new CameraFollowSession();
    session.beginFocus('D-04', d04);
    session.cancel();
    expect(session.followedRobotId).toBeNull();
    expect(session.approachingChase).toBe(false);
  });

  it('clears approach and chase for FIT FLEET', () => {
    const session = new CameraFollowSession();
    session.beginFocus('D-04', d04);
    session.cancel();
    expect(session.followedRobotId).toBeNull();
    expect(session.approachingChase).toBe(false);
  });

  it('retargets from the in-flight pose when another focus starts', () => {
    const session = new CameraFollowSession();
    const camera = { position: vec(200, 80, 180) };
    const target = vec(0, 0, 0);
    session.beginFocus('D-04', d04);
    session.tick(dt, camera, target, d04);
    const inFlight = copy(camera.position);

    session.beginFocus('H-17', h17);
    expect(session.followedRobotId).toBe('H-17');
    expect(session.approachingChase).toBe(true);
    expect(camera.position).toEqual(inFlight);

    session.tick(dt, camera, target, h17);
    const towardH17 = chasePose(h17.position, h17.headingDegrees);
    expect(vecDistance(camera.position, towardH17.position)).toBeLessThan(
      vecDistance(inFlight, towardH17.position),
    );
  });

  it('clears an active chase when focusing a different robot', () => {
    const session = new CameraFollowSession();
    session.beginFocus('D-04', d04);
    session.approachingChase = false;
    session.beginFocus('H-17', h17);
    expect(session.followedRobotId).toBe('H-17');
    expect(session.approachingChase).toBe(true);
    expect(session.chasing).toBe(false);
  });

  it('does not start chase when the target is missing at focus', () => {
    const session = new CameraFollowSession();
    session.beginFocus('M-12', null);
    expect(session.followedRobotId).toBeNull();
    expect(session.approachingChase).toBe(false);
    session.beginFocus('D-04', d04);
    expect(session.followedRobotId).toBe('D-04');
  });

  it('leaves camera pose unchanged when canceling', () => {
    const session = new CameraFollowSession();
    const camera = { position: vec(20, 11, 14) };
    session.beginFocus('D-04', d04);
    session.cancel();
    expect(camera.position).toEqual(vec(20, 11, 14));
    expect(session.followedRobotId).toBeNull();
  });

  it('cancels safely when the followed robot disappears', () => {
    const session = new CameraFollowSession();
    const camera = { position: vec(20, 11, 14) };
    const controls = vec(10, 1, 4);
    session.beginFocus('D-04', d04);
    expect(() => session.tick(dt, camera, controls, null)).not.toThrow();
    expect(session.followedRobotId).toBeNull();
    expect(camera.position).toEqual(vec(20, 11, 14));
  });
});

function vecDistance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
