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

export function createDroneVisual(): RobotVisual {
  const resources = new ResourceBag();
  const bodyMat = createBodyMaterial(resources);
  const darkMat = createBodyMaterial(resources, robotWorldTheme.graphiteDark);
  const accentMat = createAccentMaterial(resources);
  const beaconMat = createBeaconMaterial(resources);
  const group = new THREE.Group();

  group.add(mesh(resources.geometry(new THREE.BoxGeometry(3.4, 1.15, 4.4)), bodyMat));
  const canopy = mesh(resources.geometry(new THREE.BoxGeometry(2.2, 0.45, 2.1)), accentMat);
  canopy.position.set(0, 0.7, 0.55);
  group.add(canopy);

  const armGeo = resources.geometry(new THREE.BoxGeometry(4.6, 0.22, 0.28));
  const armX = mesh(armGeo, darkMat);
  const armZ = mesh(armGeo, darkMat);
  armZ.rotation.y = Math.PI / 2;
  armX.position.y = 0.15;
  armZ.position.y = 0.15;
  group.add(armX, armZ);

  const rotorGeo = resources.geometry(new THREE.TorusGeometry(1.55, 0.08, 8, 24));
  const rotors: THREE.Mesh[] = [];
  for (const [x, z] of [
    [2.35, 2.35],
    [-2.35, 2.35],
    [2.35, -2.35],
    [-2.35, -2.35],
  ] as const) {
    const rotor = mesh(rotorGeo, accentMat);
    rotor.rotation.x = Math.PI / 2;
    rotor.position.set(x, 0.42, z);
    rotors.push(rotor);
    group.add(rotor);
  }

  const nav = mesh(resources.geometry(new THREE.SphereGeometry(0.22, 10, 8)), accentMat);
  nav.position.set(0, 1.05, -1.6);
  group.add(nav);

  const beacon = mesh(resources.geometry(new THREE.SphereGeometry(0.28, 10, 8)), beaconMat);
  beacon.position.set(0, 1.2, 0);
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
      const speed = telemetry.velocityMetersPerSecond > 0.3 ? 18 : 10;
      for (const rotor of rotors) {
        rotor.rotation.z += deltaSeconds * speed;
      }
      pulse += deltaSeconds;
      if (healthStatus === 'CRITICAL') {
        beaconMat.emissiveIntensity = 0.55 + 0.55 * (0.5 + 0.5 * Math.sin(pulse * 7));
      } else {
        beaconMat.emissiveIntensity = 0.45;
      }
    },
    dispose: () => resources.dispose(),
  };
}
