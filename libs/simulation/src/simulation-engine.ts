import { Logger, TelemetryProducer, TelemetrySample } from '@prc/ports';
import {
  IdGenerator,
  MonotonicClock,
  systemMonotonicClock,
  systemWallClock,
  ulidIdGenerator,
  WallClock,
} from './clock';
import {
  BatteryOverrides,
  createFleet,
  DEFAULT_FLEET,
  FleetRobotConfig,
  SimulatedRobot,
} from './fleet';
import { tickRobot } from './physics';
import { createRandomSeed, createSeededRng, Rng } from './rng';
import { snapshotTelemetrySample } from './telemetry-sample';
import {
  DEFAULT_BASE_STATION,
  DEFAULT_WORLD_BOUNDS,
  Vec3,
  WorldBounds,
} from './world';

export interface SimulationEngineConfig {
  tickMs: number;
  telemetryIntervalMs: number;
  seed?: number;
  bounds?: WorldBounds;
  baseStation?: Vec3;
  fleet?: readonly FleetRobotConfig[];
  batteryOverrides?: BatteryOverrides;
  wallClock?: WallClock;
  monotonicClock?: MonotonicClock;
  idGenerator?: IdGenerator;
}

export class SimulationEngine {
  readonly robots: SimulatedRobot[];
  private readonly rng: Rng;
  private readonly bounds: WorldBounds;
  private readonly baseStation: Vec3;
  private readonly wallClock: WallClock;
  private readonly monotonicClock: MonotonicClock;
  private readonly idGenerator: IdGenerator;
  private readonly tickMs: number;
  private readonly telemetryIntervalMs: number;
  private readonly inFlight = new Map<string, Promise<void>>();

  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private telemetryTimer: ReturnType<typeof setInterval> | null = null;
  private lastTickMs: number | null = null;
  private running = false;
  private stopping = false;

  constructor(
    private readonly producer: TelemetryProducer,
    private readonly logger: Logger,
    config: SimulationEngineConfig,
  ) {
    this.tickMs = config.tickMs;
    this.telemetryIntervalMs = config.telemetryIntervalMs;
    this.bounds = config.bounds ?? DEFAULT_WORLD_BOUNDS;
    this.baseStation = config.baseStation ?? DEFAULT_BASE_STATION;
    this.wallClock = config.wallClock ?? systemWallClock;
    this.monotonicClock = config.monotonicClock ?? systemMonotonicClock;
    this.idGenerator = config.idGenerator ?? ulidIdGenerator();
    const seed = config.seed ?? createRandomSeed();
    this.rng = createSeededRng(seed);
    this.robots = createFleet(
      config.fleet ?? DEFAULT_FLEET,
      config.batteryOverrides,
    );
    this.logger.info('Simulation engine created', {
      operation: 'SimulationEngine',
      robotCount: this.robots.length,
      seed,
      tickMs: this.tickMs,
      telemetryIntervalMs: this.telemetryIntervalMs,
    });
  }

  /** Deterministic physics step for tests (no timers). */
  tick(deltaSeconds: number): void {
    for (const robot of this.robots) {
      tickRobot(robot, deltaSeconds, {
        bounds: this.bounds,
        baseStation: this.baseStation,
        rng: this.rng,
      });
    }
  }

  /** Snapshot all robots without sending (tests). */
  snapshotAll(): TelemetrySample[] {
    const recordedAt = this.wallClock.now();
    return this.robots.map((robot) =>
      snapshotTelemetrySample(robot, recordedAt, this.idGenerator.nextId()),
    );
  }

  /**
   * Emit one telemetry sample per robot (respects in-flight backpressure).
   * Used by the interval loop and by unit tests — no wall timers required.
   */
  async emitTelemetryOnce(): Promise<void> {
    for (const robot of this.robots) {
      if (this.inFlight.has(robot.robotId)) {
        this.logger.debug('Skipping telemetry; prior send still in flight', {
          operation: 'SimulationEngine',
          robotId: robot.robotId,
        });
        continue;
      }

      const sample = snapshotTelemetrySample(
        robot,
        this.wallClock.now(),
        this.idGenerator.nextId(),
      );

      const sendPromise = this.sendSample(sample).finally(() => {
        this.inFlight.delete(robot.robotId);
      });
      this.inFlight.set(robot.robotId, sendPromise);
    }

    // Do not await in-flight sends here — callers (interval) must not block.
    // Tests that need completion should await the producer or stop().
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.stopping = false;
    this.lastTickMs = this.monotonicClock.nowMs();

    this.tickTimer = setInterval(() => this.onTick(), this.tickMs);
    this.telemetryTimer = setInterval(
      () => {
        if (!this.running || this.stopping) return;
        void this.emitTelemetryOnce();
      },
      this.telemetryIntervalMs,
    );

    this.logger.info('Simulation started', {
      operation: 'SimulationEngine',
    });
  }

  async stop(): Promise<void> {
    if (!this.running && !this.stopping) return;
    this.stopping = true;
    this.running = false;

    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    if (this.telemetryTimer) {
      clearInterval(this.telemetryTimer);
      this.telemetryTimer = null;
    }

    await Promise.allSettled([...this.inFlight.values()]);
    this.inFlight.clear();

    this.logger.info('Simulation stopped', {
      operation: 'SimulationEngine',
    });
    this.stopping = false;
  }

  private onTick(): void {
    if (!this.running) return;
    const now = this.monotonicClock.nowMs();
    const last = this.lastTickMs ?? now;
    this.lastTickMs = now;
    const deltaSeconds = (now - last) / 1000;
    this.tick(deltaSeconds);
  }

  private async sendSample(sample: TelemetrySample): Promise<void> {
    const started = this.monotonicClock.nowMs();
    try {
      const result = await this.producer.send(sample);
      const durationMs = this.monotonicClock.nowMs() - started;
      this.logger.info('Telemetry send result', {
        operation: 'SimulationEngine',
        robotId: sample.robotId,
        sourceTelemetryId: sample.sourceTelemetryId,
        sendResult: result.status,
        durationMs,
        batteryPercent: sample.batteryPercent,
        position: sample.position,
      });
    } catch (err) {
      this.logger.error('Telemetry send threw', {
        operation: 'SimulationEngine',
        robotId: sample.robotId,
        sourceTelemetryId: sample.sourceTelemetryId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
