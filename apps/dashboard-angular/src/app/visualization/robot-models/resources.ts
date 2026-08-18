import * as THREE from 'three';

export class ResourceBag {
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];

  geometry<T extends THREE.BufferGeometry>(geometry: T): T {
    this.geometries.push(geometry);
    return geometry;
  }

  material<T extends THREE.Material>(material: T): T {
    this.materials.push(material);
    return material;
  }

  dispose(): void {
    for (const geometry of this.geometries) {
      geometry.dispose();
    }
    for (const material of this.materials) {
      material.dispose();
    }
  }
}
