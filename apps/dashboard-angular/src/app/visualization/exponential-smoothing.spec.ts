import { exponentialSmoothingAlpha, POSITION_SMOOTHING } from './exponential-smoothing';

describe('exponentialSmoothingAlpha', () => {
  it('returns 0 for non-positive deltas', () => {
    expect(exponentialSmoothingAlpha(POSITION_SMOOTHING, 0)).toBe(0);
    expect(exponentialSmoothingAlpha(POSITION_SMOOTHING, -0.1)).toBe(0);
  });

  it('matches the previous ~0.12 per-frame lerp at 60 FPS', () => {
    const alpha = exponentialSmoothingAlpha(POSITION_SMOOTHING, 1 / 60);
    expect(alpha).toBeGreaterThan(0.12);
    expect(alpha).toBeLessThan(0.13);
  });

  it('covers more ground per frame at lower FPS so time-to-target stays stable', () => {
    const at60 = exponentialSmoothingAlpha(POSITION_SMOOTHING, 1 / 60);
    const at30 = exponentialSmoothingAlpha(POSITION_SMOOTHING, 1 / 30);
    expect(at30).toBeGreaterThan(at60);
  });
});
