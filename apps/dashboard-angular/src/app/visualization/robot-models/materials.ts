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

export function createBodyMaterial(resources: ResourceBag, color = robotWorldTheme.graphite): THREE.MeshStandardMaterial {
  return resources.material(
    new THREE.MeshStandardMaterial({
      color,
      metalness: 0.55,
      roughness: 0.4,
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
      emissiveIntensity: 0.45,
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

export function mesh(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const item = new THREE.Mesh(geometry, material);
  item.castShadow = false;
  item.receiveShadow = false;
  return item;
}
