import { RobotType } from '@prc/domain';
import { Logger, TelemetryProducer, TelemetrySample } from '@prc/ports';
import {
  createSeededRng,
  createSimulatedRobot,
  DEFAULT_FLEET,
  fixedWallClock,
  sequenceIdGenerator,
  SimulationEngine,
  snapshotTelemetrySample,
  tickRobot,
  WorldBounds,
} from './index';

const silentLogger: Logger = {
  info() {},
  warn() {},
  error() {},
  debug() {},
};

const noopProducer: TelemetryProducer = {
  async send() {
    return { status: 'accepted' };
  },
};

const tightBounds: WorldBounds = {
  minX: -50,
  maxX: 50,
  minZ: -50,
  maxZ: 50,
  maxAltitude: 100,
};

describe('simulation physics', () => {
  it('moves position continuously with explicit delta time', () => {
    const robot = createSimulatedRobot(DEFAULT_FLEET[0]!);
    robot.behaviorPhase = 'moving';
    robot.target = { x: 500, y: 80, z: 500 };
    robot.headingDegrees = 45;
    robot.velocity = { x: 5, y: 0, z: 5 };

    const before = { ...robot.position };
    tickRobot(robot, 0.2, {
      bounds: tightBounds,
      baseStation: { x: 0, y: 0, z: 0 },
      rng: createSeededRng(1),
    });

    const dist = Math.hypot(
      robot.position.x - before.x,
      robot.position.y - before.y,
      robot.position.z - before.z,
    );
    expect(dist).toBeGreaterThan(0.1);
    expect(dist).toBeLessThan(5);
  });

  it('keeps ground robots near y=0', () => {
    const scout = createSimulatedRobot(
      DEFAULT_FLEET.find((r) => r.type === RobotType.SCOUT)!,
    );
    scout.position.y = 12;
    scout.velocity = { x: 2, y: 5, z: 1 };
    tickRobot(scout, 0.1, {
      bounds: tightBounds,
      baseStation: { x: 0, y: 0, z: 0 },
      rng: createSeededRng(2),
    });
    expect(scout.position.y).toBe(0);
  });

  it('allows drones to change altitude', () => {
    const drone = createSimulatedRobot(
      DEFAULT_FLEET.find((r) => r.type === RobotType.DRONE)!,
    );
    const startY = drone.position.y;
    drone.behaviorPhase = 'moving';
    drone.target = { x: drone.position.x + 100, y: 120, z: drone.position.z };
    for (let i = 0; i < 50; i++) {
      tickRobot(drone, 0.1, {
        bounds: { ...tightBounds, maxAltitude: 200 },
        baseStation: { x: 0, y: 0, z: 0 },
        rng: createSeededRng(3),
      });
    }
    expect(Math.abs(drone.position.y - startY)).toBeGreaterThan(1);
    expect(drone.position.y).toBeGreaterThan(5);
  });

  it('respects world boundaries', () => {
    const robot = createSimulatedRobot(DEFAULT_FLEET[1]!);
    robot.position = { x: 49, y: 0, z: 0 };
    robot.velocity = { x: 20, y: 0, z: 0 };
    robot.behaviorPhase = 'idle';
    for (let i = 0; i < 20; i++) {
      tickRobot(robot, 0.1, {
        bounds: tightBounds,
        baseStation: { x: 0, y: 0, z: 0 },
        rng: createSeededRng(4),
      });
    }
    expect(robot.position.x).toBeLessThanOrEqual(tightBounds.maxX);
    expect(robot.position.x).toBeGreaterThanOrEqual(tightBounds.minX);
  });

  it('decreases battery with activity and clamps 0–100', () => {
    const robot = createSimulatedRobot(DEFAULT_FLEET[1]!);
    robot.batteryPercent = 50;
    robot.behaviorPhase = 'moving';
    robot.velocity = { x: 3, y: 0, z: 0 };
    tickRobot(robot, 1, {
      bounds: tightBounds,
      baseStation: { x: 0, y: 0, z: 0 },
      rng: createSeededRng(5),
    });
    expect(robot.batteryPercent).toBeLessThan(50);
    expect(robot.batteryPercent).toBeGreaterThanOrEqual(0);

    robot.batteryPercent = 0.01;
    robot.velocity = { x: 10, y: 0, z: 0 };
    tickRobot(robot, 1, {
      bounds: tightBounds,
      baseStation: { x: 0, y: 0, z: 0 },
      rng: createSeededRng(5),
    });
    expect(robot.batteryPercent).toBe(0);
    expect(robot.velocity.x).toBe(0);
  });

  it('changes temperature gradually', () => {
    const robot = createSimulatedRobot(DEFAULT_FLEET[3]!); // miner
    robot.temperatureCelsius = 30;
    robot.behaviorPhase = 'working';
    const temps: number[] = [];
    for (let i = 0; i < 10; i++) {
      tickRobot(robot, 0.5, {
        bounds: tightBounds,
        baseStation: { x: 0, y: 0, z: 0 },
        rng: createSeededRng(6),
      });
      temps.push(robot.temperatureCelsius);
    }
    for (let i = 1; i < temps.length; i++) {
      expect(Math.abs(temps[i]! - temps[i - 1]!)).toBeLessThan(8);
    }
  });

  it('degrades signal with increasing distance from base', () => {
    const near = createSimulatedRobot(DEFAULT_FLEET[2]!);
    near.position = { x: 10, y: 0, z: 10 };
    const far = createSimulatedRobot(DEFAULT_FLEET[2]!);
    far.position = { x: 800, y: 0, z: 800 };

    const rngNear = createSeededRng(7);
    const rngFar = createSeededRng(7);
    tickRobot(near, 0.1, {
      bounds: { minX: -1000, maxX: 1000, minZ: -1000, maxZ: 1000, maxAltitude: 300 },
      baseStation: { x: 0, y: 0, z: 0 },
      rng: rngNear,
    });
    tickRobot(far, 0.1, {
      bounds: { minX: -1000, maxX: 1000, minZ: -1000, maxZ: 1000, maxAltitude: 300 },
      baseStation: { x: 0, y: 0, z: 0 },
      rng: rngFar,
    });

    expect(far.signalStrengthDbm).toBeLessThan(near.signalStrengthDbm);
  });

  it('clamps large delta times so robots do not teleport', () => {
    const robot = createSimulatedRobot(DEFAULT_FLEET[0]!);
    robot.velocity = { x: 10, y: 0, z: 0 };
    robot.behaviorPhase = 'idle';
    const before = { ...robot.position };
    tickRobot(robot, 60, {
      bounds: tightBounds,
      baseStation: { x: 0, y: 0, z: 0 },
      rng: createSeededRng(8),
    });
    const dist = Math.hypot(
      robot.position.x - before.x,
      robot.position.z - before.z,
    );
    // MAX_DELTA_SECONDS = 0.5 → at most ~5m at 10 m/s
    expect(dist).toBeLessThan(6);
  });
});

describe('deterministic simulation', () => {
  it('reproduces trajectory and telemetry for same seed + dt sequence', () => {
    function run() {
      const engine = new SimulationEngine(noopProducer, silentLogger, {
        tickMs: 100,
        telemetryIntervalMs: 1000,
        seed: 12345,
        wallClock: fixedWallClock('2026-08-14T20:00:00.000Z'),
        idGenerator: sequenceIdGenerator(
          Array.from({ length: 20 }, (_, i) => `id${i}`),
        ),
        fleet: [DEFAULT_FLEET[0]!, DEFAULT_FLEET[4]!],
      });
      const dts = [0.1, 0.1, 0.2, 0.1, 0.15, 0.1, 0.1, 0.1];
      for (const dt of dts) engine.tick(dt);
      return {
        positions: engine.robots.map((r) => ({ ...r.position })),
        batteries: engine.robots.map((r) => r.batteryPercent),
        temps: engine.robots.map((r) => r.temperatureCelsius),
        signals: engine.robots.map((r) => r.signalStrengthDbm),
        samples: engine.snapshotAll(),
      };
    }

    const a = run();
    const b = run();
    expect(a.positions).toEqual(b.positions);
    expect(a.batteries).toEqual(b.batteries);
    expect(a.temps).toEqual(b.temps);
    expect(a.signals).toEqual(b.signals);
    expect(a.samples).toEqual(b.samples);
  });
});

describe('telemetry snapshots', () => {
  it('maps current state into TelemetrySample with sim_ source id', () => {
    const robot = createSimulatedRobot(DEFAULT_FLEET[0]!);
    robot.position = { x: 1, y: 2, z: 3 };
    robot.batteryPercent = 77;
    robot.velocity = { x: 3, y: 0, z: 4 };
    const sample = snapshotTelemetrySample(
      robot,
      new Date('2026-08-14T20:00:00.000Z'),
      '01ABCDEF',
    );
    expect(sample.sourceTelemetryId).toBe('sim_D04_01ABCDEF');
    expect(sample.robotId).toBe('D-04');
    expect(sample.schemaVersion).toBe(1);
    expect(sample.recordedAt.toISOString()).toBe('2026-08-14T20:00:00.000Z');
    expect(sample.position).toEqual({ x: 1, y: 2, z: 3 });
    expect(sample.batteryPercent).toBe(77);
    expect(sample.velocityMetersPerSecond).toBe(5);
  });

  it('keeps snapshot immutable while robot continues evolving', () => {
    const robot = createSimulatedRobot(DEFAULT_FLEET[0]!);
    const sample = snapshotTelemetrySample(
      robot,
      new Date('2026-08-14T20:00:00.000Z'),
      'SNAP1',
    );
    const frozenBattery = sample.batteryPercent;
    const frozenPos = { ...sample.position };

    robot.batteryPercent = 1;
    robot.position.x = 999;
    tickRobot(robot, 0.5, {
      bounds: tightBounds,
      baseStation: { x: 0, y: 0, z: 0 },
      rng: createSeededRng(9),
    });

    expect(sample.batteryPercent).toBe(frozenBattery);
    expect(sample.position).toEqual(frozenPos);
    expect(Object.isFrozen(sample)).toBe(true);
  });
});

describe('fleet config', () => {
  it('includes the five seeded robot ids without importing prisma', () => {
    const ids = DEFAULT_FLEET.map((r) => r.robotId).sort();
    expect(ids).toEqual(['D-04', 'H-17', 'M-12', 'S-03', 'W-08'].sort());
  });

  it('applies battery overrides for threshold demos', () => {
    const robot = createSimulatedRobot(DEFAULT_FLEET[0]!, { 'D-04': 19 });
    expect(robot.batteryPercent).toBe(19);
  });
});

describe('backpressure skip', () => {
  it('skips a new sample while a prior send is in flight', async () => {
    const sent: TelemetrySample[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const producer: TelemetryProducer = {
      async send(sample) {
        sent.push(sample);
        await gate;
        return { status: 'accepted' };
      },
    };

    const engine = new SimulationEngine(producer, silentLogger, {
      tickMs: 10_000,
      telemetryIntervalMs: 10_000,
      seed: 42,
      fleet: [DEFAULT_FLEET[0]!],
      wallClock: fixedWallClock('2026-08-14T20:00:00.000Z'),
      idGenerator: sequenceIdGenerator(['a', 'b', 'c']),
    });

    void engine.emitTelemetryOnce();
    await Promise.resolve();
    expect(sent).toHaveLength(1);

    void engine.emitTelemetryOnce();
    await Promise.resolve();
    expect(sent).toHaveLength(1);

    release();
    await Promise.resolve();
    await engine.stop();
  });
});
