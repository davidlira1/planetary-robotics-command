import { loadSimulatorConfig } from './config';

describe('loadSimulatorConfig', () => {
  it('defaults TELEMETRY_INTERVAL_MS to 2000 when unset or empty', () => {
    expect(loadSimulatorConfig({}).TELEMETRY_INTERVAL_MS).toBe(2000);
    expect(loadSimulatorConfig({ TELEMETRY_INTERVAL_MS: '' }).TELEMETRY_INTERVAL_MS).toBe(
      2000,
    );
  });

  it('keeps SIMULATION_TICK_MS at 100 by default', () => {
    expect(loadSimulatorConfig({}).SIMULATION_TICK_MS).toBe(100);
  });

  it('parses an explicit telemetry interval', () => {
    expect(
      loadSimulatorConfig({ TELEMETRY_INTERVAL_MS: '500' }).TELEMETRY_INTERVAL_MS,
    ).toBe(500);
  });
});
