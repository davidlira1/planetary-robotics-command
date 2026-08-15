import { RobotType } from '@prc/domain';

export interface RobotBehaviorProfile {
  type: RobotType;
  /** Cruise / max horizontal speed (m/s). */
  maxSpeed: number;
  /** Typical operating altitude for drones; 0 for ground. */
  cruiseAltitude: number;
  /** How fast heading can change (deg/s). */
  turnRateDegPerSec: number;
  /** Base battery drain percent per second when idle. */
  baseDrainPerSec: number;
  /** Extra drain per (m/s) of speed per second. */
  movementDrainPerSpeed: number;
  /** Type-specific drain multiplier. */
  drainMultiplier: number;
  /** Ambient temperature bias (°C). */
  ambientCelsius: number;
  /** How quickly temperature approaches target (1/s). */
  tempResponseRate: number;
  /** Activity heat contribution (°C at max speed). */
  activityHeatCelsius: number;
  /** Wander/retarget interval hint (seconds). */
  retargetIntervalSec: number;
  /** For MINER: stay near home within this radius (m). */
  localizedRadius?: number;
  /** For WORKER: fraction of time spent idle (0–1). */
  idleDutyCycle?: number;
}

export const BEHAVIOR_PROFILES: Record<RobotType, RobotBehaviorProfile> = {
  [RobotType.DRONE]: {
    type: RobotType.DRONE,
    maxSpeed: 18,
    cruiseAltitude: 80,
    turnRateDegPerSec: 45,
    baseDrainPerSec: 0.015,
    movementDrainPerSpeed: 0.004,
    drainMultiplier: 1.2,
    ambientCelsius: 18,
    tempResponseRate: 0.08,
    activityHeatCelsius: 25,
    retargetIntervalSec: 12,
  },
  [RobotType.SCOUT]: {
    type: RobotType.SCOUT,
    maxSpeed: 8,
    cruiseAltitude: 0,
    turnRateDegPerSec: 60,
    baseDrainPerSec: 0.01,
    movementDrainPerSpeed: 0.003,
    drainMultiplier: 1.0,
    ambientCelsius: 22,
    tempResponseRate: 0.1,
    activityHeatCelsius: 15,
    retargetIntervalSec: 8,
  },
  [RobotType.HAULER]: {
    type: RobotType.HAULER,
    maxSpeed: 3.5,
    cruiseAltitude: 0,
    turnRateDegPerSec: 20,
    baseDrainPerSec: 0.012,
    movementDrainPerSpeed: 0.008,
    drainMultiplier: 1.6,
    ambientCelsius: 24,
    tempResponseRate: 0.06,
    activityHeatCelsius: 30,
    retargetIntervalSec: 20,
  },
  [RobotType.WORKER]: {
    type: RobotType.WORKER,
    maxSpeed: 2.5,
    cruiseAltitude: 0,
    turnRateDegPerSec: 35,
    baseDrainPerSec: 0.008,
    movementDrainPerSpeed: 0.002,
    drainMultiplier: 0.9,
    ambientCelsius: 23,
    tempResponseRate: 0.09,
    activityHeatCelsius: 12,
    retargetIntervalSec: 6,
    idleDutyCycle: 0.45,
  },
  [RobotType.MINER]: {
    type: RobotType.MINER,
    maxSpeed: 1.5,
    cruiseAltitude: 0,
    turnRateDegPerSec: 25,
    baseDrainPerSec: 0.014,
    movementDrainPerSpeed: 0.005,
    drainMultiplier: 1.3,
    ambientCelsius: 28,
    tempResponseRate: 0.07,
    activityHeatCelsius: 40,
    retargetIntervalSec: 15,
    localizedRadius: 80,
  },
};
