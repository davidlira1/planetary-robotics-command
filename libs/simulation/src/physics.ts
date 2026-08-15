import { RobotType } from '@prc/domain';
import { SimulatedRobot } from './fleet';
import { Rng } from './rng';
import {
  clamp,
  clampDeltaSeconds,
  distance3,
  normalizeHeading,
  Vec3,
  WorldBounds,
} from './world';

function speedOf(v: Vec3): number {
  return Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
}

function headingFromVelocity(v: Vec3): number {
  if (Math.abs(v.x) < 1e-6 && Math.abs(v.z) < 1e-6) return 0;
  const rad = Math.atan2(v.x, v.z);
  return normalizeHeading((rad * 180) / Math.PI);
}

function pickTarget(
  robot: SimulatedRobot,
  bounds: WorldBounds,
  rng: Rng,
): Vec3 {
  const margin = 20;
  let x = rng.nextRange(bounds.minX + margin, bounds.maxX - margin);
  let z = rng.nextRange(bounds.minZ + margin, bounds.maxZ - margin);
  let y = 0;

  if (robot.type === RobotType.DRONE) {
    y = rng.nextRange(
      robot.profile.cruiseAltitude * 0.4,
      Math.min(bounds.maxAltitude, robot.profile.cruiseAltitude * 1.4),
    );
  }

  if (robot.profile.localizedRadius != null) {
    const r = robot.profile.localizedRadius;
    x = clamp(
      robot.home.x + rng.nextSigned(r),
      bounds.minX + margin,
      bounds.maxX - margin,
    );
    z = clamp(
      robot.home.z + rng.nextSigned(r),
      bounds.minZ + margin,
      bounds.maxZ - margin,
    );
  }

  return { x, y, z };
}

function approachHeading(
  current: number,
  desired: number,
  maxTurnDeg: number,
): number {
  let delta = ((desired - current + 540) % 360) - 180;
  if (delta > maxTurnDeg) delta = maxTurnDeg;
  if (delta < -maxTurnDeg) delta = -maxTurnDeg;
  return normalizeHeading(current + delta);
}

function enforceBounds(robot: SimulatedRobot, bounds: WorldBounds): void {
  const p = robot.position;
  const v = robot.velocity;

  if (p.x < bounds.minX) {
    p.x = bounds.minX;
    v.x = Math.abs(v.x);
  } else if (p.x > bounds.maxX) {
    p.x = bounds.maxX;
    v.x = -Math.abs(v.x);
  }

  if (p.z < bounds.minZ) {
    p.z = bounds.minZ;
    v.z = Math.abs(v.z);
  } else if (p.z > bounds.maxZ) {
    p.z = bounds.maxZ;
    v.z = -Math.abs(v.z);
  }

  if (robot.type === RobotType.DRONE) {
    if (p.y < 5) {
      p.y = 5;
      v.y = Math.abs(v.y);
    } else if (p.y > bounds.maxAltitude) {
      p.y = bounds.maxAltitude;
      v.y = -Math.abs(v.y);
    }
  } else {
    p.y = 0;
    v.y = 0;
  }
}

function updateBehaviorPhase(
  robot: SimulatedRobot,
  dt: number,
  bounds: WorldBounds,
  rng: Rng,
): void {
  robot.phaseTimerSec -= dt;
  if (robot.phaseTimerSec > 0) return;

  const idleDuty = robot.profile.idleDutyCycle ?? 0;
  if (idleDuty > 0 && rng.next() < idleDuty) {
    robot.behaviorPhase = 'idle';
    robot.velocity = { x: 0, y: 0, z: 0 };
    robot.phaseTimerSec = rng.nextRange(2, 8);
    return;
  }

  if (robot.type === RobotType.MINER && rng.next() < 0.35) {
    robot.behaviorPhase = 'working';
    robot.velocity = { x: 0, y: 0, z: 0 };
    robot.phaseTimerSec = rng.nextRange(3, 10);
    return;
  }

  robot.behaviorPhase = 'moving';
  robot.target = pickTarget(robot, bounds, rng);
  robot.phaseTimerSec = robot.profile.retargetIntervalSec * rng.nextRange(0.7, 1.3);
}

function steerTowardTarget(robot: SimulatedRobot, dt: number): void {
  if (robot.behaviorPhase !== 'moving' || robot.batteryPercent <= 0) {
    robot.velocity = { x: 0, y: 0, z: 0 };
    return;
  }

  const dx = robot.target.x - robot.position.x;
  const dz = robot.target.z - robot.position.z;
  const dy =
    robot.type === RobotType.DRONE
      ? robot.target.y - robot.position.y
      : 0;

  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (dist < 3) {
    robot.velocity = { x: 0, y: 0, z: 0 };
    robot.phaseTimerSec = 0;
    return;
  }

  const desiredHeading = headingFromVelocity({ x: dx, y: 0, z: dz });
  const maxTurn = robot.profile.turnRateDegPerSec * dt;
  robot.headingDegrees = approachHeading(
    robot.headingDegrees,
    desiredHeading,
    maxTurn,
  );

  const rad = (robot.headingDegrees * Math.PI) / 180;
  const horizontalSpeed = Math.min(robot.profile.maxSpeed, dist * 0.4);
  const vx = Math.sin(rad) * horizontalSpeed;
  const vz = Math.cos(rad) * horizontalSpeed;
  let vy = 0;
  if (robot.type === RobotType.DRONE) {
    vy = clamp(dy * 0.35, -robot.profile.maxSpeed * 0.4, robot.profile.maxSpeed * 0.4);
  }

  robot.velocity = { x: vx, y: vy, z: vz };
}

function updateBattery(robot: SimulatedRobot, dt: number): void {
  const speed = speedOf(robot.velocity);
  const drain =
    (robot.profile.baseDrainPerSec +
      speed * robot.profile.movementDrainPerSpeed) *
    robot.profile.drainMultiplier *
    dt;
  robot.batteryPercent = clamp(robot.batteryPercent - drain, 0, 100);
  if (robot.batteryPercent <= 0) {
    robot.velocity = { x: 0, y: 0, z: 0 };
  }
}

function updateTemperature(robot: SimulatedRobot, dt: number): void {
  const speedRatio = speedOf(robot.velocity) / Math.max(robot.profile.maxSpeed, 0.01);
  const workingBoost =
    robot.behaviorPhase === 'working'
      ? robot.profile.activityHeatCelsius * 0.8
      : robot.profile.activityHeatCelsius * speedRatio;
  const target =
    robot.profile.ambientCelsius + workingBoost;
  const alpha = 1 - Math.exp(-robot.profile.tempResponseRate * dt);
  robot.temperatureCelsius += (target - robot.temperatureCelsius) * alpha;
}

function updateSignal(
  robot: SimulatedRobot,
  base: Vec3,
  dt: number,
  rng: Rng,
): void {
  const dist = distance3(robot.position, base);
  // Believable path-loss-ish curve: ~ -45 near base, ~ -110 at 1.5km
  const baseSignal = -45 - dist * 0.04;
  robot.signalNoise += (rng.nextSigned(1.5) - robot.signalNoise) * Math.min(1, dt * 2);
  robot.signalStrengthDbm = clamp(baseSignal + robot.signalNoise, -120, -35);
}

export interface PhysicsContext {
  bounds: WorldBounds;
  baseStation: Vec3;
  rng: Rng;
}

/**
 * Advance one robot by actual elapsed seconds (clamped).
 * Call from tests with explicit dt — no timers required.
 */
export function tickRobot(
  robot: SimulatedRobot,
  deltaSeconds: number,
  ctx: PhysicsContext,
): void {
  const dt = clampDeltaSeconds(deltaSeconds);
  if (dt <= 0) return;

  updateBehaviorPhase(robot, dt, ctx.bounds, ctx.rng);
  steerTowardTarget(robot, dt);

  robot.position.x += robot.velocity.x * dt;
  robot.position.y += robot.velocity.y * dt;
  robot.position.z += robot.velocity.z * dt;

  enforceBounds(robot, ctx.bounds);
  updateBattery(robot, dt);
  updateTemperature(robot, dt);
  updateSignal(robot, ctx.baseStation, dt, ctx.rng);
}
