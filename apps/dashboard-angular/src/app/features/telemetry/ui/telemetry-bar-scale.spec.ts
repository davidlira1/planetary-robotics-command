import {
  SIGNAL_VISUAL_MAX_DBM,
  SIGNAL_VISUAL_MIN_DBM,
  signalBarPercent,
  temperatureBarPercent,
  velocityBarPercent,
} from './telemetry-bar-scale';

describe('telemetry bar scale', () => {
  it('maps signal dBm across the visual range only', () => {
    expect(signalBarPercent(SIGNAL_VISUAL_MIN_DBM)).toBe(0);
    expect(signalBarPercent(SIGNAL_VISUAL_MAX_DBM)).toBe(100);
    expect(signalBarPercent(-80)).toBe(50);
  });

  it('maps temperature and velocity into 0–100% without using health thresholds', () => {
    expect(temperatureBarPercent(-20)).toBe(0);
    expect(temperatureBarPercent(80)).toBe(100);
    expect(temperatureBarPercent(30)).toBe(50);
    expect(velocityBarPercent(0)).toBe(0);
    expect(velocityBarPercent(12)).toBe(100);
    expect(velocityBarPercent(6)).toBe(50);
  });
});
