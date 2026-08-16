import { cameraPositionFromTarget, fitDistance, fleetFitDistance, sphereFitDistance } from './camera-fit';
import type { FleetBounds } from './fleet-bounds';

const fovY = (42 * Math.PI) / 180;

function bounds(horizontalSpan: number, height = 0): FleetBounds {
  return {
    min: { x: 0, y: 0, z: 0 },
    max: { x: horizontalSpan, y: height, z: 0 },
    center: { x: horizontalSpan / 2, y: height / 2, z: 0 },
    width: horizontalSpan,
    height,
    depth: 0,
    horizontalSpan,
  };
}

describe('camera-fit', () => {
  it('requires a larger distance for a larger fleet span', () => {
    const small = fleetFitDistance(bounds(100), fovY, 16 / 9);
    const large = fleetFitDistance(bounds(400), fovY, 16 / 9);
    expect(large).toBeGreaterThan(small);
  });

  it('uses aspect ratio so a narrower view needs more distance', () => {
    const wide = fitDistance(200, fovY, 16 / 9);
    const narrow = fitDistance(200, fovY, 0.5);
    expect(narrow).toBeGreaterThan(wide);
  });

  it('places the camera along the view direction from the target center', () => {
    const position = cameraPositionFromTarget({ x: 10, y: 0, z: -4 }, { x: 0, y: 1, z: 0 }, 50);
    expect(position).toEqual({ x: 10, y: 50, z: -4 });
  });

  it('derives the fleet center from bounds', () => {
    expect(bounds(200, 40).center).toEqual({ x: 100, y: 20, z: 0 });
  });

  it('uses the tighter of vertical and horizontal FOV for a bounding sphere', () => {
    const wide = sphereFitDistance(200, fovY, 16 / 9);
    const narrow = sphereFitDistance(200, fovY, 0.5);
    expect(narrow).toBeGreaterThan(wide);
    expect(wide).toBeGreaterThan(200);
  });
});
