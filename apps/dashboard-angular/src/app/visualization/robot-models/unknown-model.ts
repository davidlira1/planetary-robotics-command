import * as THREE from 'three';
import {
  applyHealthToBeacon,
  applyHoverHighlight,
  applySelectionEmissive,
  createAccentMaterial,
  createBeaconMaterial,
  createBodyMaterial,
  mesh,
} from './materials';
import { ResourceBag } from './resources';
import type { RobotVisual, RobotVisualState, RobotVisualTelemetry } from './robot-visual';

export function createUnknownVisual(): RobotVisual {
  const resources = new ResourceBag();
  const bodyMat = createBodyMaterial(resources);
  const accentMat = createAccentMaterial(resources);
  const beaconMat = createBeaconMaterial(resources);
  const group = new THREE.Group();

  const body = mesh(resources.geometry(new THREE.CapsuleGeometry(1.6, 2.4, 6, 12)), bodyMat);
  body.position.y = 2.2;
  group.add(body);

  const band = mesh(resources.geometry(new THREE.TorusGeometry(1.65, 0.1, 8, 20)), accentMat);
  band.position.y = 2.2;
  group.add(band);

  const beacon = mesh(resources.geometry(new THREE.SphereGeometry(0.24, 10, 8)), beaconMat);
  beacon.position.set(0, 4.0, 0);
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
    tick(deltaSeconds, _telemetry: RobotVisualTelemetry) {
      pulse += deltaSeconds;
      beaconMat.emissiveIntensity =
        healthStatus === 'CRITICAL' ? 0.55 + 0.55 * (0.5 + 0.5 * Math.sin(pulse * 7)) : 0.5;
    },
    dispose: () => resources.dispose(),
  };
}
