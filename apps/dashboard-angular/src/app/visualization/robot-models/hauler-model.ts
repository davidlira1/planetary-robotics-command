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

export function createHaulerVisual(): RobotVisual {
  const resources = new ResourceBag();
  const bodyMat = createBodyMaterial(resources);
  const darkMat = createDarkMetalMaterial(resources);
  const accentMat = createAccentMaterial(resources);
  const beaconMat = createBeaconMaterial(resources);
  const group = new THREE.Group();

  const chassis = mesh(resources.geometry(new THREE.BoxGeometry(5.8, 1.35, 11)), bodyMat);
  chassis.position.y = 1.55;
  group.add(chassis);

  const cargo = mesh(resources.geometry(new THREE.BoxGeometry(5.2, 2.3, 7.2)), darkMat);
  cargo.position.set(0, 3.2, -1.1);
  group.add(cargo);

  const cabin = mesh(resources.geometry(new THREE.BoxGeometry(4.2, 1.7, 2.5)), bodyMat);
  cabin.position.set(0, 2.9, 4.3);
  group.add(cabin);

  const window = mesh(resources.geometry(new THREE.BoxGeometry(3.4, 0.7, 0.2)), accentMat);
  window.position.set(0, 3.15, 5.56);
  group.add(window);

  const wheelGeo = resources.geometry(new THREE.CylinderGeometry(1.55, 1.55, 0.72, 16));
  const wheels: THREE.Mesh[] = [];
  for (const [x, z] of [
    [3.15, 3.5],
    [-3.15, 3.5],
    [3.15, -3.5],
    [-3.15, -3.5],
  ] as const) {
    const wheel = mesh(wheelGeo, darkMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 1.55, z);
    wheels.push(wheel);
    group.add(wheel);
  }

  const beacon = mesh(resources.geometry(new THREE.SphereGeometry(0.28, 10, 8)), beaconMat);
  beacon.position.set(0, 4.55, 4.3);
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
      const spin = (telemetry.velocityMetersPerSecond / 1.55) * deltaSeconds;
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
