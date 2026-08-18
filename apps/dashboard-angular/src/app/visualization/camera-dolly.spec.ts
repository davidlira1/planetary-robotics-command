import * as THREE from 'three';
import { aimCamera } from './camera-aim';
import { dollyInspectionPose } from './camera-dolly';
import { DEFAULT_VIEW_OFFSET, MIN_INSPECTION_DISTANCE, normalizeDirection } from './camera-fit';
import { RobotWorldCameraController } from './robot-world-camera-controller';
import type { Vec3 } from './fleet-bounds';

const ROBOT: Vec3 = { x: 140.2, y: 11.8, z: 72.4 };
const FLEET_CENTER: Vec3 = { x: 40, y: 30, z: -35 };
const OVERVIEW_CAMERA: Vec3 = { x: 80, y: 70, z: 110 };
const VIEWPORT = { width: 1280, height: 720 };

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function parallel(a: Vec3, b: Vec3): void {
  const na = normalizeDirection(a);
  const nb = normalizeDirection(b);
  expect(na.x).toBeCloseTo(nb.x, 5);
  expect(na.y).toBeCloseTo(nb.y, 5);
  expect(na.z).toBeCloseTo(nb.z, 5);
}

function projectRobot(camera: THREE.PerspectiveCamera, robot: Vec3) {
  camera.updateMatrixWorld(true);
  const ndc = new THREE.Vector3(robot.x, robot.y, robot.z).project(camera);
  return { x: ndc.x, y: ndc.y, z: ndc.z };
}

describe('dollyInspectionPose', () => {
  it('preserves the camera→robot direction, not the camera→fleet-center direction', () => {
    const pose = dollyInspectionPose(OVERVIEW_CAMERA, ROBOT, MIN_INSPECTION_DISTANCE);
    const towardRobot = normalizeDirection({
      x: OVERVIEW_CAMERA.x - ROBOT.x,
      y: OVERVIEW_CAMERA.y - ROBOT.y,
      z: OVERVIEW_CAMERA.z - ROBOT.z,
    });
    const towardFleet = normalizeDirection({
      x: OVERVIEW_CAMERA.x - FLEET_CENTER.x,
      y: OVERVIEW_CAMERA.y - FLEET_CENTER.y,
      z: OVERVIEW_CAMERA.z - FLEET_CENTER.z,
    });
    expect(pose.target).toEqual(ROBOT);
    parallel(pose.direction, towardRobot);
    expect(pose.direction.x).not.toBeCloseTo(towardFleet.x, 2);
    expect(distance(pose.position, ROBOT)).toBeCloseTo(MIN_INSPECTION_DISTANCE);
  });

  it('falls back to the default view offset when the camera is on the robot', () => {
    const pose = dollyInspectionPose(ROBOT, ROBOT, MIN_INSPECTION_DISTANCE);
    expect(distance(pose.position, ROBOT)).toBeCloseTo(MIN_INSPECTION_DISTANCE);
    expect(pose.target).toEqual(ROBOT);
  });

  it('dollies from an orbited camera pose, not the default Deep Space angle', () => {
    const orbited: Vec3 = { x: 320, y: 180, z: 440 };
    const pose = dollyInspectionPose(orbited, ROBOT, MIN_INSPECTION_DISTANCE);
    const fromOrbit = normalizeDirection({
      x: orbited.x - ROBOT.x,
      y: orbited.y - ROBOT.y,
      z: orbited.z - ROBOT.z,
    });
    const defaultAngle = normalizeDirection(DEFAULT_VIEW_OFFSET);
    parallel(pose.direction, fromOrbit);
    expect(pose.direction.x).not.toBeCloseTo(defaultAngle.x, 2);
    expect(pose.direction.y).not.toBeCloseTo(defaultAngle.y, 2);
  });
});

describe('focus dolly animation', () => {
  it('leaves camera.position and controls.target unchanged until the first animation tick', () => {
    const camera = new THREE.PerspectiveCamera(42, VIEWPORT.width / VIEWPORT.height, 0.1, 2000);
    const controls = { target: new THREE.Vector3(FLEET_CENTER.x, FLEET_CENTER.y, FLEET_CENTER.z) };
    camera.position.set(320, 180, 440);
    const startPosition = camera.position.clone();
    const startTarget = controls.target.clone();
    const pose = dollyInspectionPose(startPosition, ROBOT, MIN_INSPECTION_DISTANCE);
    const controller = new RobotWorldCameraController();
    controller.begin(pose.position, pose.target);

    expect(camera.position.toArray()).toEqual(startPosition.toArray());
    expect(controls.target.toArray()).toEqual(startTarget.toArray());
    expect(pose.position.x).not.toBeCloseTo(startPosition.x, 5);

    controller.tick(1 / 60, camera, controls);
    expect(camera.position.equals(startPosition)).toBe(false);
    expect(controls.target.equals(startTarget)).toBe(false);
    expect(distance(camera.position, ROBOT)).toBeLessThan(distance(startPosition, ROBOT));
  });

  it('eases an off-center robot into the viewport without a target snap', () => {
    const camera = new THREE.PerspectiveCamera(42, VIEWPORT.width / VIEWPORT.height, 0.1, 2000);
    const controls = { target: new THREE.Vector3(FLEET_CENTER.x, FLEET_CENTER.y, FLEET_CENTER.z) };
    camera.position.set(OVERVIEW_CAMERA.x, OVERVIEW_CAMERA.y, OVERVIEW_CAMERA.z);
    aimCamera(camera, controls, camera.position, controls.target);

    const startDistance = distance(camera.position, ROBOT);
    expect(startDistance).toBeGreaterThan(MIN_INSPECTION_DISTANCE);
    const startNdc = projectRobot(camera, ROBOT);
    expect(Math.hypot(startNdc.x, startNdc.y)).toBeGreaterThan(0.15);

    const startTarget = controls.target.clone();
    const pose = dollyInspectionPose(camera.position, ROBOT, MIN_INSPECTION_DISTANCE);
    const controller = new RobotWorldCameraController();
    controller.begin(pose.position, pose.target);
    expect(controls.target.toArray()).toEqual(startTarget.toArray());

    aimCamera(camera, controls, camera.position, controls.target);
    const afterBeginNdc = projectRobot(camera, ROBOT);
    expect(Math.hypot(afterBeginNdc.x, afterBeginNdc.y)).toBeGreaterThan(0.15);

    let previousCameraDistance = startDistance;
    let previousTargetDistance = distance(controls.target, ROBOT);
    let ticks = 0;
    while (controller.active && ticks < 240) {
      controller.tick(1 / 60, camera, controls);
      aimCamera(camera, controls, camera.position, {
        x: controls.target.x,
        y: controls.target.y,
        z: controls.target.z,
      });
      const currentCameraDistance = distance(camera.position, ROBOT);
      const currentTargetDistance = distance(controls.target, ROBOT);
      expect(currentCameraDistance).toBeLessThanOrEqual(previousCameraDistance + 1e-9);
      expect(currentTargetDistance).toBeLessThanOrEqual(previousTargetDistance + 1e-9);
      if (ticks === 0) {
        const firstNdc = projectRobot(camera, ROBOT);
        expect(Math.hypot(firstNdc.x, firstNdc.y)).toBeGreaterThan(0.1);
        expect(currentTargetDistance).toBeGreaterThan(1);
      }
      previousCameraDistance = currentCameraDistance;
      previousTargetDistance = currentTargetDistance;
      ticks += 1;
    }

    expect(controller.active).toBe(false);
    expect(controls.target.x).toBeCloseTo(ROBOT.x, 5);
    expect(controls.target.y).toBeCloseTo(ROBOT.y, 5);
    expect(controls.target.z).toBeCloseTo(ROBOT.z, 5);
    expect(distance(camera.position, ROBOT)).toBeCloseTo(MIN_INSPECTION_DISTANCE, 5);
    const endNdc = projectRobot(camera, ROBOT);
    expect(endNdc.x).toBeCloseTo(0, 3);
    expect(endNdc.y).toBeCloseTo(0, 3);
  });
});
