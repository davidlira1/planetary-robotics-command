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

export function createScoutVisual(): RobotVisual {
  const resources = new ResourceBag();
  const bodyMat = createBodyMaterial(resources);
  const darkMat = createDarkMetalMaterial(resources);
  const accentMat = createAccentMaterial(resources);
  const beaconMat = createBeaconMaterial(resources);
  const group = new THREE.Group();

  const chassis = mesh(resources.geometry(new THREE.BoxGeometry(3.1, 0.95, 6.8)), bodyMat);
  chassis.position.y = 0.95;
  group.add(chassis);

  const nose = mesh(resources.geometry(new THREE.BoxGeometry(2.2, 0.7, 1.5)), darkMat);
  nose.position.set(0, 0.95, 3.5);
  group.add(nose);

  const wheelRadius = 0.78;
  const wheels: THREE.Group[] = [];
  for (const [x, z] of [
    [1.7, 2.15],
    [-1.7, 2.15],
    [1.7, -2.15],
    [-1.7, -2.15],
  ] as const) {
    const wheel = createWheelAssembly(resources, { radius: wheelRadius, width: 0.42 });
    wheel.group.position.set(x, wheelRadius, z);
    wheels.push(wheel.group);
    group.add(wheel.group);
  }

  const mast = mesh(resources.geometry(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 8)), darkMat);
  mast.position.set(0, 2.15, 2.55);
  group.add(mast);

  const camera = mesh(resources.geometry(new THREE.BoxGeometry(0.55, 0.38, 0.5)), accentMat);
  camera.position.set(0, 3.25, 2.75);
  group.add(camera);

  const beacon = mesh(resources.geometry(new THREE.SphereGeometry(0.22, 10, 8)), beaconMat);
  beacon.position.set(0, 3.55, 2.55);
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
