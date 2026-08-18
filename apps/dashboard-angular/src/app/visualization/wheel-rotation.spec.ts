import { wheelRotationRadians, WHEEL_FORWARD_SIGN } from './wheel-rotation';

describe('wheelRotationRadians', () => {
  it('is zero when travel is zero', () => {
    expect(wheelRotationRadians(0, 0.78)).toBe(0);
    expect(wheelRotationRadians(1e-12, 0.78)).toBe(0);
  });

  it('is zero when radius is not positive', () => {
    expect(wheelRotationRadians(2, 0)).toBe(0);
    expect(wheelRotationRadians(2, -1)).toBe(0);
  });

  it('matches distance / radius with the forward-spin sign', () => {
    expect(wheelRotationRadians(1.55, 1.55)).toBeCloseTo(WHEEL_FORWARD_SIGN);
    expect(wheelRotationRadians(0.78, 0.78)).toBeCloseTo(WHEEL_FORWARD_SIGN);
  });

  it('scales proportionally with rendered travel, independent of frame dt', () => {
    const small = wheelRotationRadians(1, 0.7);
    const large = wheelRotationRadians(3, 0.7);
    expect(large).toBeCloseTo(small * 3);
  });
});
