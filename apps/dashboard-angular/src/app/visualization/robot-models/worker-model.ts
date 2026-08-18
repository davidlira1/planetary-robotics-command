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

export function createWorkerVisual(): RobotVisual {
  const resources = new ResourceBag();
  const bodyMat = createBodyMaterial(resources);
  const darkMat = createBodyMaterial(resources, robotWorldTheme.graphiteDark);
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

  const wheelGeo = resources.geometry(new THREE.CylinderGeometry(0.7, 0.7, 0.4, 12));
  for (const [x, z] of [
    [1.55, 1.5],
    [-1.55, 1.5],
    [1.55, -1.5],
    [-1.55, -1.5],
  ] as const) {
    const wheel = mesh(wheelGeo, darkMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.7, z);
    group.add(wheel);
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
    },
    tick(deltaSeconds, _telemetry: RobotVisualTelemetry) {
      pulse += deltaSeconds;
      beaconMat.emissiveIntensity =
        healthStatus === 'CRITICAL' ? 0.55 + 0.55 * (0.5 + 0.5 * Math.sin(pulse * 7)) : 0.45;
    },
    dispose: () => resources.dispose(),
  };
}
