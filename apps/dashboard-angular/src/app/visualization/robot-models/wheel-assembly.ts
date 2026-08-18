import * as THREE from 'three';
import { robotWorldTheme } from '../robot-world-theme';
import { mesh } from './materials';
import { ResourceBag } from './resources';

export interface WheelAssembly {
  group: THREE.Group;
  radius: number;
}

interface WheelKit {
  tireGeo: THREE.CylinderGeometry;
  grooveGeo: THREE.CylinderGeometry;
  hubGeo: THREE.CylinderGeometry;
  rubber: THREE.MeshStandardMaterial;
  groove: THREE.MeshStandardMaterial;
  hub: THREE.MeshStandardMaterial;
}

const kitsByResources = new WeakMap<ResourceBag, Map<string, WheelKit>>();

function wheelKit(resources: ResourceBag, radius: number, width: number): WheelKit {
  let byKey = kitsByResources.get(resources);
  if (!byKey) {
    byKey = new Map();
    kitsByResources.set(resources, byKey);
  }
  const key = `${radius}:${width}`;
  const existing = byKey.get(key);
  if (existing) {
    return existing;
  }

  const kit: WheelKit = {
    tireGeo: resources.geometry(new THREE.CylinderGeometry(radius, radius, width, 24)),
    grooveGeo: resources.geometry(
      new THREE.CylinderGeometry(radius * 0.94, radius * 0.94, Math.max(width * 0.06, 0.03), 24),
    ),
    hubGeo: resources.geometry(
      new THREE.CylinderGeometry(radius * 0.42, radius * 0.42, width * 1.08, 16),
    ),
    rubber: resources.material(
      new THREE.MeshStandardMaterial({
        color: robotWorldTheme.graphiteDark,
        metalness: 0.08,
        roughness: 0.88,
      }),
    ),
    groove: resources.material(
      new THREE.MeshStandardMaterial({
        color: 0x0a0c10,
        metalness: 0.04,
        roughness: 0.95,
      }),
    ),
    hub: resources.material(
      new THREE.MeshStandardMaterial({
        color: robotWorldTheme.metal,
        metalness: 0.78,
        roughness: 0.28,
      }),
    ),
  };
  byKey.set(key, kit);
  return kit;
}

export function createWheelAssembly(
  resources: ResourceBag,
  options: { radius: number; width: number },
): WheelAssembly {
  const { radius, width } = options;
  const kit = wheelKit(resources, radius, width);
  const group = new THREE.Group();
  group.add(mesh(kit.tireGeo, kit.rubber));

  const grooveCount = 5;
  for (let i = 0; i < grooveCount; i += 1) {
    const ring = mesh(kit.grooveGeo, kit.groove);
    ring.position.y = ((i + 0.5) / grooveCount - 0.5) * width * 0.72;
    group.add(ring);
  }

  group.add(mesh(kit.hubGeo, kit.hub));
  group.rotation.z = Math.PI / 2;
  return { group, radius };
}
