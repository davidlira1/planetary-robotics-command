import * as THREE from 'three';
import { robotWorldTheme } from '../robot-world-theme';
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

export function createMinerVisual(): RobotVisual {
  const resources = new ResourceBag();
  const bodyMat = createBodyMaterial(resources);
  const darkMat = createDarkMetalMaterial(resources);
  const accentMat = createAccentMaterial(resources);
  const beaconMat = createBeaconMaterial(resources);
  const utilityMat = resources.material(
    new THREE.MeshStandardMaterial({
      color: robotWorldTheme.warning,
      emissive: robotWorldTheme.warning,
      emissiveIntensity: 0.35,
      metalness: 0.15,
      roughness: 0.45,
    }),
  );
  const group = new THREE.Group();

  const chassis = mesh(resources.geometry(new THREE.BoxGeometry(4.8, 1.55, 8.2)), bodyMat);
  chassis.position.y = 1.45;
  group.add(chassis);

  const cabin = mesh(resources.geometry(new THREE.BoxGeometry(3.4, 1.6, 2.4)), darkMat);
  cabin.position.set(0, 2.85, -1.6);
  group.add(cabin);

  const boom = mesh(resources.geometry(new THREE.BoxGeometry(0.55, 0.55, 3.6)), darkMat);
  boom.position.set(0, 2.15, 4.2);
  group.add(boom);

  const drill = mesh(resources.geometry(new THREE.CylinderGeometry(0.42, 0.28, 3.4, 10)), accentMat);
  drill.rotation.x = Math.PI / 2;
  drill.position.set(0, 2.15, 6.5);
  group.add(drill);

  const bit = mesh(resources.geometry(new THREE.ConeGeometry(0.38, 1.1, 8)), darkMat);
  bit.rotation.x = Math.PI / 2;
  bit.position.set(0, 2.15, 8.4);
  group.add(bit);

  for (const x of [-1.7, 1.7]) {
    const lamp = mesh(resources.geometry(new THREE.SphereGeometry(0.18, 8, 8)), utilityMat);
    lamp.position.set(x, 2.05, 3.9);
    group.add(lamp);
  }

  const wheelRadius = 1.15;
  const wheels: THREE.Group[] = [];
  for (const [x, z] of [
    [2.55, 2.4],
    [-2.55, 2.4],
    [2.55, -2.4],
    [-2.55, -2.4],
  ] as const) {
    const wheel = createWheelAssembly(resources, { radius: wheelRadius, width: 0.7 });
    wheel.group.position.set(x, wheelRadius, z);
    wheels.push(wheel.group);
    group.add(wheel.group);
  }

  const beacon = mesh(resources.geometry(new THREE.SphereGeometry(0.26, 10, 8)), beaconMat);
  beacon.position.set(0, 3.85, -1.6);
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
      drill.rotation.y += deltaSeconds * 2.4;
      pulse += deltaSeconds;
      beaconMat.emissiveIntensity =
        healthStatus === 'CRITICAL' ? 0.55 + 0.55 * (0.5 + 0.5 * Math.sin(pulse * 7)) : 0.5;
    },
    dispose: () => resources.dispose(),
  };
}
