import * as THREE from 'three';
import type { RobotWorldRobot } from '../robot-world';
import { robotWorldTheme } from '../robot-world-theme';
import { ResourceBag } from './resources';

export function healthColor(status: RobotWorldRobot['healthStatus']): number {
  if (status === 'WARNING') {
    return robotWorldTheme.warning;
  }
  if (status === 'CRITICAL') {
    return robotWorldTheme.critical;
  }
  if (status === 'HEALTHY') {
    return robotWorldTheme.normal;
  }
  return robotWorldTheme.muted;
}

export const BODY_METALNESS = 0.72;
export const BODY_ROUGHNESS = 0.32;
export const HOVER_HULL_EMISSIVE = 0.06;

export function createBodyMaterial(
  resources: ResourceBag,
  color = robotWorldTheme.metal,
): THREE.MeshStandardMaterial {
  return resources.material(
    new THREE.MeshStandardMaterial({
      color,
      metalness: BODY_METALNESS,
      roughness: BODY_ROUGHNESS,
    }),
  );
}

export function createDarkMetalMaterial(resources: ResourceBag): THREE.MeshStandardMaterial {
  return resources.material(
    new THREE.MeshStandardMaterial({
      color: robotWorldTheme.metalDark,
      metalness: 0.7,
      roughness: 0.38,
    }),
  );
}

export function createAccentMaterial(resources: ResourceBag): THREE.MeshStandardMaterial {
  return resources.material(
    new THREE.MeshStandardMaterial({
      color: robotWorldTheme.accent,
      emissive: robotWorldTheme.accent,
      emissiveIntensity: 0.25,
      metalness: 0.2,
      roughness: 0.35,
    }),
  );
}

export function createBeaconMaterial(resources: ResourceBag): THREE.MeshStandardMaterial {
  return resources.material(
    new THREE.MeshStandardMaterial({
      color: robotWorldTheme.muted,
      emissive: robotWorldTheme.muted,
      emissiveIntensity: 0.5,
      metalness: 0.1,
      roughness: 0.4,
    }),
  );
}

export function applyHealthToBeacon(
  beacon: THREE.MeshStandardMaterial,
  status: RobotWorldRobot['healthStatus'],
): void {
  const color = healthColor(status);
  beacon.color.setHex(color);
  beacon.emissive.setHex(color);
}

export function applySelectionEmissive(accent: THREE.MeshStandardMaterial, selected: boolean): void {
  accent.emissiveIntensity = selected ? 0.7 : 0.25;
}

export function applyHoverHighlight(
  body: THREE.MeshStandardMaterial,
  hovered: boolean,
  selected: boolean,
): void {
  if (selected || !hovered) {
    body.emissive.setHex(0);
    body.emissiveIntensity = 0;
    return;
  }
  body.emissive.setHex(robotWorldTheme.metal);
  body.emissiveIntensity = HOVER_HULL_EMISSIVE;
}

export function mesh(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const item = new THREE.Mesh(geometry, material);
  item.castShadow = false;
  item.receiveShadow = false;
  return item;
}
