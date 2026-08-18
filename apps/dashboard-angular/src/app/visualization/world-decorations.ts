import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { robotWorldTheme } from './robot-world-theme';

export function createWorldDecorations(): { group: THREE.Group; dispose: () => void } {
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const group = new THREE.Group();
  group.name = 'world-decorations';

  const markMat = new THREE.MeshBasicMaterial({
    color: robotWorldTheme.ring,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  const faintMat = new THREE.MeshBasicMaterial({
    color: robotWorldTheme.ring,
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
  });
  materials.push(markMat, faintMat);

  const padGeo = new THREE.CylinderGeometry(2.4, 2.4, 0.18, 24);
  const pylonGeo = new THREE.CylinderGeometry(0.22, 0.32, 4.2, 8);
  const capGeo = new THREE.CylinderGeometry(0.55, 0.22, 0.35, 8);
  geometries.push(padGeo, pylonGeo, capGeo);

  const pad = new THREE.Mesh(padGeo, markMat);
  pad.position.y = 0.05;
  const pylon = new THREE.Mesh(pylonGeo, markMat);
  pylon.position.y = 2.2;
  const cap = new THREE.Mesh(capGeo, markMat);
  cap.position.y = 4.4;
  group.add(pad, pylon, cap);

  const tickGeo = new THREE.BoxGeometry(3.2, 0.08, 0.12);
  geometries.push(tickGeo);
  for (const yaw of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    const tick = new THREE.Mesh(tickGeo, markMat);
    tick.position.set(Math.sin(yaw) * 6.5, 0.08, Math.cos(yaw) * 6.5);
    tick.rotation.y = yaw;
    group.add(tick);
  }

  for (const radius of [28, 72]) {
    const ringGeo = new THREE.RingGeometry(radius - 0.35, radius + 0.35, 64);
    geometries.push(ringGeo);
    const ring = new THREE.Mesh(ringGeo, faintMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    group.add(ring);
  }

  const labelElement =
    typeof document !== 'undefined' ? document.createElement('div') : createDetachedBaseLabel();
  labelElement.className = 'prc-robot-label prc-robot-label--base';
  labelElement.innerHTML =
    '<span class="prc-robot-label__id">BASE</span><span class="prc-robot-label__type">ORIGIN</span>';
  const label = new CSS2DObject(labelElement);
  label.position.set(0, 6.2, 0);
  group.add(label);

  return {
    group,
    dispose() {
      labelElement.remove();
      for (const geometry of geometries) {
        geometry.dispose();
      }
      for (const material of materials) {
        material.dispose();
      }
    },
  };
}

function createDetachedBaseLabel(): HTMLDivElement {
  return {
    className: 'prc-robot-label prc-robot-label--base',
    innerHTML: '',
    remove() {
      /* no-op */
    },
  } as HTMLDivElement;
}
