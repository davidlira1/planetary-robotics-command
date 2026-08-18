import * as THREE from 'three';
import {
  applyHealthToBeacon,
  applyHoverHighlight,
  applySelectionEmissive,
  createAccentMaterial,
  createBeaconMaterial,
  createBodyMaterial,
  createDarkMetalMaterial,
  mesh,
} from './materials';
import { ResourceBag } from './resources';
import type { RobotVisual, RobotVisualState, RobotVisualTelemetry } from './robot-visual';
import { createWheelAssembly } from './wheel-assembly';
import { wheelRotationRadians } from '../wheel-rotation';

export function createWorkerVisual(): RobotVisual {
  const resources = new ResourceBag();
  const bodyMat = createBodyMaterial(resources);
  const darkMat = createDarkMetalMaterial(resources);
  const accentMat = createAccentMaterial(resources);
  const beaconMat = createBeaconMaterial(resources);
  const group = new THREE.Group();

  const chassis = mesh(resources.geometry(new THREE.BoxGeometry(3.2, 1.15, 4.8)), bodyMat);
  chassis.position.y = 1.05;
  group.add(chassis);

  const torso = mesh(resources.geometry(new THREE.BoxGeometry(2.15, 1.7, 1.9)), darkMat);
  torso.position.set(0, 2.4, 0.15);
  group.add(torso);

  const arm = mesh(resources.geometry(new THREE.BoxGeometry(0.38, 0.38, 2.4)), bodyMat);
  arm.position.set(1.35, 2.55, 1.35);
  group.add(arm);

  const tool = mesh(resources.geometry(new THREE.BoxGeometry(0.55, 0.55, 0.85)), accentMat);
  tool.position.set(1.35, 2.55, 2.7);
  group.add(tool);

  const wheelRadius = 0.7;
  const wheels: THREE.Group[] = [];
  for (const [x, z] of [
    [1.55, 1.5],
    [-1.55, 1.5],
    [1.55, -1.5],
    [-1.55, -1.5],
  ] as const) {
    const wheel = createWheelAssembly(resources, { radius: wheelRadius, width: 0.4 });
    wheel.group.position.set(x, wheelRadius, z);
    wheels.push(wheel.group);
    group.add(wheel.group);
  }

  const beacon = mesh(resources.geometry(new THREE.SphereGeometry(0.22, 10, 8)), beaconMat);
  beacon.position.set(0, 3.45, 0.15);
  group.add(beacon);

  let healthStatus: RobotVisualState['healthStatus'] = null;
  let pulse = 0;

  return {
    group,
    updateVisualState(state) {
      healthStatus = state.healthStatus;
      applyHealthToBeacon(beaconMat, state.healthStatus);
      applySelectionEmissive(accentMat, state.selected);
      applyHoverHighlight(bodyMat, state.hovered, state.selected);
    },
    tick(deltaSeconds, telemetry: RobotVisualTelemetry) {
      const spin = wheelRotationRadians(telemetry.travelDistanceMeters, wheelRadius);
      for (const wheel of wheels) {
        wheel.rotation.x += spin;
      }
      pulse += deltaSeconds;
      beaconMat.emissiveIntensity =
        healthStatus === 'CRITICAL' ? 0.55 + 0.55 * (0.5 + 0.5 * Math.sin(pulse * 7)) : 0.5;
    },
    dispose: () => resources.dispose(),
  };
}
