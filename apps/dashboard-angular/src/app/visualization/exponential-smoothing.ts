/** ~0.12 lerp alpha at 60 FPS, matching the previous per-frame constant. */
export const POSITION_SMOOTHING = 8;

export function exponentialSmoothingAlpha(smoothing: number, deltaSeconds: number): number {
  if (deltaSeconds <= 0) {
    return 0;
  }
  return 1 - Math.exp(-smoothing * deltaSeconds);
}
