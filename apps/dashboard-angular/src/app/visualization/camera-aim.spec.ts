import * as THREE from 'three';
import { aimCamera } from './camera-aim';
import { cameraPositionFromTarget, fleetFitDistance, normalizeDirection } from './camera-fit';
import { calculateFleetBounds } from './fleet-bounds';
import { RobotSceneObject } from './robot-scene-object';
import type { RobotWorldRobot } from './robot-world';

const D04 = { x: 140.2, y: 11.8, z: 72.4 };
const VIEWPORT = { width: 1280, height: 720 };

function positioned(id: string, position: { x: number; y: number; z: number }): RobotWorldRobot {
  return { id, type: 'DRONE', position, headingDegrees: 0, healthStatus: null };
}

function fittedCamera(robots: RobotWorldRobot[]) {
  const bounds = calculateFleetBounds(robots);
  if (!bounds) {
    throw new Error('expected fleet bounds');
  }
  const camera = new THREE.PerspectiveCamera(42, VIEWPORT.width / VIEWPORT.height, 0.1, 2000);
  const controls = { target: new THREE.Vector3(0, 0, 0) };
  camera.position.set(80, 70, 110);
  const direction = normalizeDirection({
    x: camera.position.x - controls.target.x,
    y: camera.position.y - controls.target.y,
    z: camera.position.z - controls.target.z,
  });
  const distance = fleetFitDistance(bounds, THREE.MathUtils.degToRad(camera.fov), camera.aspect);
  const position = cameraPositionFromTarget(bounds.center, direction, distance);
  aimCamera(camera, controls, position, bounds.center);
  return { bounds, camera, controls, distance, position };
}

function framingReport(
  robot: THREE.Vector3,
  camera: THREE.PerspectiveCamera,
  controls: { target: THREE.Vector3 },
  center: { x: number; y: number; z: number },
) {
  camera.updateMatrixWorld(true);
  const worldDirection = new THREE.Vector3();
  camera.getWorldDirection(worldDirection);
  const cameraToTarget = new THREE.Vector3().subVectors(controls.target, camera.position);
  const ndc = robot.clone().project(camera);
  return {
    robotTarget: robot.toArray(),
    fleetCenter: [center.x, center.y, center.z],
    orbitTarget: controls.target.toArray(),
    cameraPosition: camera.position.toArray(),
    worldDirection: worldDirection.toArray(),
    cameraToTarget: cameraToTarget.toArray(),
    renderer: { width: VIEWPORT.width, height: VIEWPORT.height, aspect: camera.aspect },
    ndc: { x: ndc.x, y: ndc.y, z: ndc.z },
  };
}

describe('single-robot framing invariant', () => {
  it('uses the same world coordinate for RobotSceneObject.group and fleet bounds', () => {
    const robot = positioned('D-04', D04);
    const object = new RobotSceneObject(robot);
    const bounds = calculateFleetBounds([robot]);
    expect(object.group.position.x).toBeCloseTo(D04.x);
    expect(object.group.position.y).toBeCloseTo(D04.y);
    expect(object.group.position.z).toBeCloseTo(D04.z);
    expect(object.targetPosition.x).toBeCloseTo(bounds!.center.x);
    expect(object.targetPosition.y).toBeCloseTo(bounds!.center.y);
    expect(object.targetPosition.z).toBeCloseTo(bounds!.center.z);
  });

  it('projects D-04 to the extreme bottom-right when the camera still looks at the origin', () => {
    const camera = new THREE.PerspectiveCamera(42, VIEWPORT.width / VIEWPORT.height, 0.1, 2000);
    const controls = { target: new THREE.Vector3(0, 0, 0) };
    camera.position.set(80, 70, 110);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    const report = framingReport(new THREE.Vector3(D04.x, D04.y, D04.z), camera, controls, D04);
    expect(report.ndc.x).toBeGreaterThan(1);
    expect(report.ndc.y).toBeLessThan(-1);
  });

  it('projects D-04 to NDC origin after aim — FIT FLEET single-robot invariant', () => {
    const { camera, controls, bounds, position, distance } = fittedCamera([positioned('D-04', D04)]);
    const report = framingReport(new THREE.Vector3(D04.x, D04.y, D04.z), camera, controls, bounds.center);

    expect(bounds.center).toEqual(D04);
    expect(report.orbitTarget[0]).toBeCloseTo(D04.x);
    expect(report.orbitTarget[1]).toBeCloseTo(D04.y);
    expect(report.orbitTarget[2]).toBeCloseTo(D04.z);
    expect(report.cameraPosition[0]).toBeCloseTo(position.x);
    expect(report.cameraPosition[1]).toBeCloseTo(position.y);
    expect(report.cameraPosition[2]).toBeCloseTo(position.z);
    expect(report.worldDirection[0]).toBeCloseTo(report.cameraToTarget[0] / distance, 2);
    expect(report.worldDirection[1]).toBeCloseTo(report.cameraToTarget[1] / distance, 2);
    expect(report.worldDirection[2]).toBeCloseTo(report.cameraToTarget[2] / distance, 2);
    expect(report.renderer.aspect).toBeCloseTo(16 / 9);
    expect(report.ndc.x).toBeCloseTo(0, 3);
    expect(report.ndc.y).toBeCloseTo(0, 3);
  });
});

describe('five-robot bounding-sphere framing', () => {
  const fleet = [
    positioned('D-04', { x: 50, y: 60, z: -40 }),
    positioned('H-17', { x: -120, y: 0, z: 80 }),
    positioned('W-08', { x: 30, y: 0, z: 20 }),
    positioned('M-12', { x: 200, y: 0, z: -150 }),
    positioned('S-03', { x: -60, y: 0, z: -90 }),
  ];

  it('projects the sphere center to NDC origin and keeps every robot in view', () => {
    const { camera, controls, bounds } = fittedCamera(fleet);
    const center = new THREE.Vector3(bounds.center.x, bounds.center.y, bounds.center.z);
    const centerNdc = center.clone().project(camera);

    expect(controls.target.x).toBeCloseTo(bounds.center.x);
    expect(controls.target.y).toBeCloseTo(bounds.center.y);
    expect(controls.target.z).toBeCloseTo(bounds.center.z);
    expect(centerNdc.x).toBeCloseTo(0, 3);
    expect(centerNdc.y).toBeCloseTo(0, 3);

    for (const robot of fleet) {
      const ndc = new THREE.Vector3(robot.position!.x, robot.position!.y, robot.position!.z).project(camera);
      expect(Math.abs(ndc.x)).toBeLessThan(1);
      expect(Math.abs(ndc.y)).toBeLessThan(1);
    }
  });
});
