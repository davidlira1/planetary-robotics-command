import { headingToGroundDirection, lerpHeadingDegrees, normalizeHeadingDegrees } from './heading';

describe('headingToGroundDirection', () => {
  it('maps 0° to +Z (north)', () => {
    const direction = headingToGroundDirection(0);
    expect(direction.x).toBeCloseTo(0);
    expect(direction.z).toBeCloseTo(1);
  });

  it('maps 90° to +X (east)', () => {
    const direction = headingToGroundDirection(90);
    expect(direction.x).toBeCloseTo(1);
    expect(direction.z).toBeCloseTo(0);
  });

  it('maps 180° to −Z (south)', () => {
    const direction = headingToGroundDirection(180);
    expect(direction.x).toBeCloseTo(0);
    expect(direction.z).toBeCloseTo(-1);
  });

  it('maps 270° to −X (west)', () => {
    const direction = headingToGroundDirection(270);
    expect(direction.x).toBeCloseTo(-1);
    expect(direction.z).toBeCloseTo(0);
  });
});

describe('lerpHeadingDegrees', () => {
  it('takes the shortest wrap from 350° toward 10°', () => {
    expect(lerpHeadingDegrees(350, 10, 0.5)).toBeCloseTo(0);
  });

  it('takes the shortest wrap from 10° toward 350°', () => {
    expect(lerpHeadingDegrees(10, 350, 0.5)).toBeCloseTo(0);
  });

  it('reaches the target at alpha 1', () => {
    expect(lerpHeadingDegrees(350, 10, 1)).toBeCloseTo(10);
    expect(normalizeHeadingDegrees(370)).toBeCloseTo(10);
  });
});
