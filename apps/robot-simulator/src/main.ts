import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { HttpTelemetryProducer } from '@prc/http-telemetry-producer';
import { Logger } from '@prc/ports';
import { DEFAULT_FLEET, SimulationEngine } from '@prc/simulation';
import { batteryOverridesFromEnv, loadSimulatorConfig } from './config';

loadEnv({ path: resolve(__dirname, '../../../.env') });

const logger: Logger = {
  info(message, fields) {
    console.log(JSON.stringify({ level: 'info', msg: message, ...fields }));
  },
  warn(message, fields) {
    console.warn(JSON.stringify({ level: 'warn', msg: message, ...fields }));
  },
  error(message, fields) {
    console.error(JSON.stringify({ level: 'error', msg: message, ...fields }));
  },
  debug(message, fields) {
    if (process.env.SIMULATOR_DEBUG === '1') {
      console.debug(JSON.stringify({ level: 'debug', msg: message, ...fields }));
    }
  },
};

async function main() {
  const env = loadSimulatorConfig();
  const abort = new AbortController();

  const producer = new HttpTelemetryProducer(
    {
      baseUrl: env.SIMULATOR_API_BASE_URL,
      maxAttempts: env.TELEMETRY_MAX_ATTEMPTS,
      initialDelayMs: env.TELEMETRY_RETRY_INITIAL_MS,
      maxDelayMs: env.TELEMETRY_RETRY_MAX_MS,
      getSignal: () => abort.signal,
    },
    logger,
  );

  const engine = new SimulationEngine(producer, logger, {
    tickMs: env.SIMULATION_TICK_MS,
    telemetryIntervalMs: env.TELEMETRY_INTERVAL_MS,
    seed: env.SIMULATION_SEED,
    bounds: {
      minX: env.SIMULATION_WORLD_MIN_X,
      maxX: env.SIMULATION_WORLD_MAX_X,
      minZ: env.SIMULATION_WORLD_MIN_Z,
      maxZ: env.SIMULATION_WORLD_MAX_Z,
      maxAltitude: env.SIMULATION_MAX_ALTITUDE,
    },
    baseStation: {
      x: env.SIMULATION_BASE_X,
      y: env.SIMULATION_BASE_Y,
      z: env.SIMULATION_BASE_Z,
    },
    batteryOverrides: batteryOverridesFromEnv(env),
  });

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.info('Shutting down simulator', {
      operation: 'robot-simulator',
      signal,
    });
    abort.abort();
    await engine.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  engine.start();
  logger.info('Robot simulator running', {
    operation: 'robot-simulator',
    apiBaseUrl: env.SIMULATOR_API_BASE_URL,
    tickMs: env.SIMULATION_TICK_MS,
    telemetryIntervalMs: env.TELEMETRY_INTERVAL_MS,
    defaultFleetIds: DEFAULT_FLEET.map((r) => r.robotId),
    constructedIds: engine.robots.map((r) => r.robotId),
    telemetryEmittingIds: engine.robots.map((r) => r.robotId),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
