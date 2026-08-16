/**
 * Presentation-only ranges for Asset Telemetry bar widths (0–100%).
 * These are not backend health thresholds and must not be used for status.
 */
export const SIGNAL_VISUAL_MIN_DBM = -120;
export const SIGNAL_VISUAL_MAX_DBM = -40;
export const TEMPERATURE_VISUAL_MIN_C = -20;
export const TEMPERATURE_VISUAL_MAX_C = 80;
export const VELOCITY_VISUAL_MIN_MPS = 0;
export const VELOCITY_VISUAL_MAX_MPS = 12;

export function visualBarPercent(value: number, min: number, max: number): number {
  if (max <= min) {
    return 0;
  }
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

export function signalBarPercent(dbm: number): number {
  return visualBarPercent(dbm, SIGNAL_VISUAL_MIN_DBM, SIGNAL_VISUAL_MAX_DBM);
}

export function temperatureBarPercent(celsius: number): number {
  return visualBarPercent(celsius, TEMPERATURE_VISUAL_MIN_C, TEMPERATURE_VISUAL_MAX_C);
}

export function velocityBarPercent(metersPerSecond: number): number {
  return visualBarPercent(metersPerSecond, VELOCITY_VISUAL_MIN_MPS, VELOCITY_VISUAL_MAX_MPS);
}
