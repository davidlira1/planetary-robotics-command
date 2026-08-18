import {
  cameraPositionFromTarget,
  calculateTightFleetCameraDistance,
  DEFAULT_VIEW_OFFSET,
  fitDistance,
  fleetFitDistance,
  MIN_FLEET_OVERVIEW_DISTANCE,
  MIN_INSPECTION_DISTANCE,
  INSPECTION_MARKER_RADIUS,
  sphereFitDistance,
} from './camera-fit';
import type { FleetBounds, Vec3 } from './fleet-bounds';

const fovY = (42 * Math.PI) / 180;
const seededFleet: Vec3[] = [
  { x: 50, y: 60, z: -40 },
  { x: -120, y: 0, z: 80 },
  { x: 30, y: 0, z: 20 },
  { x: 200, y: 0, z: -150 },
  { x: -60, y: 0, z: -90 },
];

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

describe('calculateTightFleetCameraDistance', () => {
  it('is tighter than conservative sphere fit for a representative flat fleet', () => {
    const tight = calculateTightFleetCameraDistance(seededFleet, DEFAULT_VIEW_OFFSET, fovY, 16 / 9);
    const sphere = fleetFitDistance(
      {
        min: { x: -120, y: 0, z: -150 },
        max: { x: 200, y: 60, z: 80 },
        center: { x: 40, y: 30, z: -35 },
        width: 320,
        height: 60,
        depth: 230,
        horizontalSpan: 320,
      },
      fovY,
      16 / 9,
    );
    expect(tight).toBeLessThan(sphere);
    expect(tight).toBeGreaterThan(MIN_FLEET_OVERVIEW_DISTANCE);
  });

  it('floors a single robot to a useful overview distance', () => {
    const distance = calculateTightFleetCameraDistance(
      [{ x: 140.2, y: 11.8, z: 72.4 }],
      DEFAULT_VIEW_OFFSET,
      fovY,
      16 / 9,
    );
    expect(distance).toBe(MIN_FLEET_OVERVIEW_DISTANCE);
  });

  it('uses a closer floor for inspection of one robot', () => {
    const distance = calculateTightFleetCameraDistance(
      [{ x: 10, y: 0, z: -4 }],
      DEFAULT_VIEW_OFFSET,
      fovY,
      16 / 9,
      { minDistance: MIN_INSPECTION_DISTANCE, markerRadius: INSPECTION_MARKER_RADIUS },
    );
    expect(distance).toBe(MIN_INSPECTION_DISTANCE);
    expect(distance).toBeGreaterThanOrEqual(20);
    expect(distance).toBeLessThan(
      calculateTightFleetCameraDistance(seededFleet, DEFAULT_VIEW_OFFSET, fovY, 16 / 9),
    );
  });

  it('requires more distance for a narrower aspect ratio', () => {
    const wide = calculateTightFleetCameraDistance(seededFleet, DEFAULT_VIEW_OFFSET, fovY, 16 / 9);
    const narrow = calculateTightFleetCameraDistance(seededFleet, DEFAULT_VIEW_OFFSET, fovY, 0.5);
    expect(narrow).toBeGreaterThan(wide);
  });

  it('fits mixed negative and positive coordinates', () => {
    const distance = calculateTightFleetCameraDistance(
      [
        { x: -80, y: 0, z: -40 },
        { x: 90, y: 12, z: 55 },
      ],
      DEFAULT_VIEW_OFFSET,
      fovY,
      16 / 9,
    );
    expect(Number.isFinite(distance)).toBe(true);
    expect(distance).toBeGreaterThan(MIN_FLEET_OVERVIEW_DISTANCE);
  });

  it('falls back to sphere fit when the view direction is parallel to world up', () => {
    const tight = calculateTightFleetCameraDistance(seededFleet, { x: 0, y: 1, z: 0 }, fovY, 16 / 9);
    const sphere = fleetFitDistance(
      {
        min: { x: -120, y: 0, z: -150 },
        max: { x: 200, y: 60, z: 80 },
        center: { x: 40, y: 30, z: -35 },
        width: 320,
        height: 60,
        depth: 230,
        horizontalSpan: 320,
      },
      fovY,
      16 / 9,
    );
    expect(tight).toBeCloseTo(Math.max(MIN_FLEET_OVERVIEW_DISTANCE, sphere));
  });
});
