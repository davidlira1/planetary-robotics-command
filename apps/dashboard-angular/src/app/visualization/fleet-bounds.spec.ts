import { boundingSphereRadius, calculateFleetBounds } from './fleet-bounds';
import type { RobotWorldRobot } from './robot-world';

function robot(id: string, position: RobotWorldRobot['position']): RobotWorldRobot {
  return {
    id,
    type: 'DRONE',
    position,
    headingDegrees: 0,
    healthStatus: null,
  };
}

describe('calculateFleetBounds', () => {
  it('returns null when no robots are positioned', () => {
    expect(calculateFleetBounds([])).toBeNull();
    expect(calculateFleetBounds([robot('D-04', null)])).toBeNull();
  });

  it('ignores null-position robots', () => {
    const bounds = calculateFleetBounds([
      robot('D-04', { x: 10, y: 0, z: 20 }),
      robot('W-08', null),
    ]);
    expect(bounds?.center).toEqual({ x: 10, y: 0, z: 20 });
    expect(bounds?.width).toBe(0);
  });

  it('covers a single robot', () => {
    const bounds = calculateFleetBounds([robot('D-04', { x: -4, y: 12, z: 8 })]);
    expect(bounds).toEqual({
      min: { x: -4, y: 12, z: 8 },
      max: { x: -4, y: 12, z: 8 },
      center: { x: -4, y: 12, z: 8 },
      width: 0,
      height: 0,
      depth: 0,
      horizontalSpan: 0,
    });
  });

  it('covers multiple robots with mixed signs and drone altitude', () => {
    const bounds = calculateFleetBounds([
      robot('D-04', { x: -100, y: 80, z: 10 }),
      robot('H-17', { x: 50, y: 0, z: -40 }),
    ]);
    expect(bounds?.min).toEqual({ x: -100, y: 0, z: -40 });
    expect(bounds?.max).toEqual({ x: 50, y: 80, z: 10 });
    expect(bounds?.center).toEqual({ x: -25, y: 40, z: -15 });
    expect(bounds?.width).toBe(150);
    expect(bounds?.height).toBe(80);
    expect(bounds?.depth).toBe(50);
    expect(bounds?.horizontalSpan).toBe(150);
  });

  it('encloses the five seeded simulator start positions', () => {
    const bounds = calculateFleetBounds([
      robot('D-04', { x: 50, y: 60, z: -40 }),
      robot('H-17', { x: -120, y: 0, z: 80 }),
      robot('W-08', { x: 30, y: 0, z: 20 }),
      robot('M-12', { x: 200, y: 0, z: -150 }),
      robot('S-03', { x: -60, y: 0, z: -90 }),
    ]);
    expect(bounds?.min).toEqual({ x: -120, y: 0, z: -150 });
    expect(bounds?.max).toEqual({ x: 200, y: 60, z: 80 });
    expect(bounds?.center).toEqual({ x: 40, y: 30, z: -35 });
    expect(boundingSphereRadius(bounds!)).toBeGreaterThan(bounds!.horizontalSpan / 2);
  });
});
