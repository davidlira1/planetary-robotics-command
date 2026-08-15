import { z } from 'zod';

const numberFromEnv = (fallback: number) =>
  z.preprocess(
    (v) => (v === undefined || v === '' ? fallback : Number(v)),
    z.number().finite(),
  );

const optionalNumber = z.preprocess(
  (v) => (v === undefined || v === '' ? undefined : Number(v)),
  z.number().finite().optional(),
);

export const SimulatorEnvSchema = z.object({
  SIMULATOR_API_BASE_URL: z.string().url().default('http://localhost:3000'),
  SIMULATION_TICK_MS: numberFromEnv(100),
  TELEMETRY_INTERVAL_MS: numberFromEnv(1000),
  SIMULATION_SEED: optionalNumber,
  SIMULATION_WORLD_MIN_X: numberFromEnv(-1000),
  SIMULATION_WORLD_MAX_X: numberFromEnv(1000),
  SIMULATION_WORLD_MIN_Z: numberFromEnv(-1000),
  SIMULATION_WORLD_MAX_Z: numberFromEnv(1000),
  SIMULATION_MAX_ALTITUDE: numberFromEnv(300),
  SIMULATION_BASE_X: numberFromEnv(0),
  SIMULATION_BASE_Y: numberFromEnv(0),
  SIMULATION_BASE_Z: numberFromEnv(0),
  TELEMETRY_MAX_ATTEMPTS: numberFromEnv(5),
  TELEMETRY_RETRY_INITIAL_MS: numberFromEnv(500),
  TELEMETRY_RETRY_MAX_MS: numberFromEnv(8000),
  SIM_D04_BATTERY: optionalNumber,
  SIM_H17_BATTERY: optionalNumber,
  SIM_W08_BATTERY: optionalNumber,
  SIM_M12_BATTERY: optionalNumber,
  SIM_S03_BATTERY: optionalNumber,
});

export type SimulatorEnv = z.infer<typeof SimulatorEnvSchema>;

export function loadSimulatorConfig(
  env: NodeJS.ProcessEnv = process.env,
): SimulatorEnv {
  return SimulatorEnvSchema.parse(env);
}

export function batteryOverridesFromEnv(
  env: SimulatorEnv,
): Partial<Record<string, number>> {
  const overrides: Partial<Record<string, number>> = {};
  if (env.SIM_D04_BATTERY != null) overrides['D-04'] = env.SIM_D04_BATTERY;
  if (env.SIM_H17_BATTERY != null) overrides['H-17'] = env.SIM_H17_BATTERY;
  if (env.SIM_W08_BATTERY != null) overrides['W-08'] = env.SIM_W08_BATTERY;
  if (env.SIM_M12_BATTERY != null) overrides['M-12'] = env.SIM_M12_BATTERY;
  if (env.SIM_S03_BATTERY != null) overrides['S-03'] = env.SIM_S03_BATTERY;
  return overrides;
}
