import * as THREE from 'three';
import { robotWorldTheme } from '../robot-world-theme';
import {
  applyHealthToBeacon,
  applySelectionEmissive,
  createAccentMaterial,
  createBeaconMaterial,
  createBodyMaterial,
  mesh,
} from './materials';
import { ResourceBag } from './resources';
import type { RobotVisual, RobotVisualState, RobotVisualTelemetry } from './robot-visual';

export function createScoutVisual(): RobotVisual {
  const resources = new ResourceBag();
  const bodyMat = createBodyMaterial(resources);
  const darkMat = createBodyMaterial(resources, robotWorldTheme.graphiteDark);
  const accentMat = createAccentMaterial(resources);
  const beaconMat = createBeaconMaterial(resources);
  const group = new THREE.Group();

  const chassis = mesh(resources.geometry(new THREE.BoxGeometry(3.1, 0.95, 6.8)), bodyMat);
  chassis.position.y = 0.95;
  group.add(chassis);

  const nose = mesh(resources.geometry(new THREE.BoxGeometry(2.2, 0.7, 1.5)), darkMat);
  nose.position.set(0, 0.95, 3.5);
  group.add(nose);

  const wheelGeo = resources.geometry(new THREE.CylinderGeometry(0.78, 0.78, 0.42, 14));
  const wheels: THREE.Mesh[] = [];
  for (const [x, z] of [
    [1.7, 2.15],
    [-1.7, 2.15],
    [1.7, -2.15],
    [-1.7, -2.15],
  ] as const) {
    const wheel = mesh(wheelGeo, darkMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.78, z);
    wheels.push(wheel);
    group.add(wheel);
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
    },
    tick(deltaSeconds, telemetry: RobotVisualTelemetry) {
      const spin = (telemetry.velocityMetersPerSecond / 0.78) * deltaSeconds;
      for (const wheel of wheels) {
        wheel.rotation.x += spin;
      }
      pulse += deltaSeconds;
      beaconMat.emissiveIntensity =
        healthStatus === 'CRITICAL' ? 0.55 + 0.55 * (0.5 + 0.5 * Math.sin(pulse * 7)) : 0.45;
    },
    dispose: () => resources.dispose(),
  };
}
