import { Object3D } from 'three';

export class CSS2DObject extends Object3D {
  constructor(public element: { remove(): void }) {
    super();
  }
}

export class CSS2DRenderer {
  readonly domElement = {
    style: {} as Record<string, string>,
    remove(): void {
      /* no-op */
    },
  };

  setSize(_width: number, _height: number): void {
    /* no-op */
  }

  render(): void {
    /* no-op */
  }
}
