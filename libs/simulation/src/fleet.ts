import { Position, RobotType } from '@prc/domain';
import { BEHAVIOR_PROFILES, RobotBehaviorProfile } from './profiles';
import { Vec3 } from './world';

export type BehaviorPhase = 'moving' | 'idle' | 'working';

export interface SimulatedRobot {
  robotId: string;
  type: RobotType;
  profile: RobotBehaviorProfile;
  position: Position;
  /** Velocity vector in m/s (Cartesian). */
  velocity: Vec3;
  headingDegrees: number;
  batteryPercent: number;
  temperatureCelsius: number;
  signalStrengthDbm: number;
  behaviorPhase: BehaviorPhase;
  /** Wander / path target. */
  target: Vec3;
  /** Home for localized miners. */
  home: Vec3;
  /** Seconds until next retarget / phase change. */
  phaseTimerSec: number;
  /** Smooth signal noise state. */
  signalNoise: number;
}

export interface FleetRobotConfig {
  robotId: string;
  type: RobotType;
  model: string;
  initialPosition: Position;
  initialBatteryPercent: number;
  initialTemperatureCelsius?: number;
}

/**
 * Fleet matching the five platform seed robot IDs/types.
 * Kept inside simulation — does not import persistence seed code.
 */
export const DEFAULT_FLEET: readonly FleetRobotConfig[] = [
  {
    robotId: 'D-04',
    type: RobotType.DRONE,
    model: 'AX-4 Survey Drone',
    initialPosition: { x: 50, y: 60, z: -40 },
    initialBatteryPercent: 92,
    initialTemperatureCelsius: 20,
  },
  {
    robotId: 'H-17',
    type: RobotType.HAULER,
    model: 'HX-9 Heavy Transport',
    initialPosition: { x: -120, y: 0, z: 80 },
    initialBatteryPercent: 78,
    initialTemperatureCelsius: 26,
  },
  {
    robotId: 'W-08',
    type: RobotType.WORKER,
    model: 'WX-3 Utility Droid',
    initialPosition: { x: 30, y: 0, z: 20 },
    initialBatteryPercent: 85,
    initialTemperatureCelsius: 24,
  },
  {
    robotId: 'M-12',
    type: RobotType.MINER,
    model: 'MX-7 Excavation Unit',
    initialPosition: { x: 200, y: 0, z: -150 },
    initialBatteryPercent: 70,
    initialTemperatureCelsius: 32,
  },
  {
    robotId: 'S-03',
    type: RobotType.SCOUT,
    model: 'SX-2 Recon Rover',
    initialPosition: { x: -60, y: 0, z: -90 },
    initialBatteryPercent: 88,
    initialTemperatureCelsius: 22,
  },
] as const;

export type BatteryOverrides = Partial<Record<string, number>>;

export function createSimulatedRobot(
  config: FleetRobotConfig,
  overrides?: BatteryOverrides,
): SimulatedRobot {
  const profile = BEHAVIOR_PROFILES[config.type];
  const battery =
    overrides?.[config.robotId] ??
    overrides?.[config.robotId.replace('-', '')] ??
    config.initialBatteryPercent;
  const home = { ...config.initialPosition };
  const y =
    config.type === RobotType.DRONE
      ? Math.max(config.initialPosition.y, profile.cruiseAltitude * 0.5)
      : 0;

  return {
    robotId: config.robotId,
    type: config.type,
    profile,
    position: { x: config.initialPosition.x, y, z: config.initialPosition.z },
    velocity: { x: 0, y: 0, z: 0 },
    headingDegrees: 0,
    batteryPercent: Math.min(100, Math.max(0, battery)),
    temperatureCelsius:
      config.initialTemperatureCelsius ?? profile.ambientCelsius,
    signalStrengthDbm: -55,
    behaviorPhase: 'moving',
    target: { ...home },
    home,
    phaseTimerSec: profile.retargetIntervalSec,
    signalNoise: 0,
  };
}

export function createFleet(
  fleet: readonly FleetRobotConfig[] = DEFAULT_FLEET,
  batteryOverrides?: BatteryOverrides,
): SimulatedRobot[] {
  return fleet.map((cfg) => createSimulatedRobot(cfg, batteryOverrides));
}
