/**
 * Simulation thresholds for Layer 2 health evaluation.
 * Not universal robotics standards — easy to change without messaging infra.
 */
export const HEALTH_THRESHOLDS = {
  battery: {
    warningBelow: 20,
    criticalBelow: 10,
  },
  temperature: {
    warningAbove: 80,
    criticalAbove: 95,
  },
  signal: {
    warningBelowDbm: -90,
    criticalBelowDbm: -105,
  },
} as const;
