import { resolveRobotWorldType } from './robot-world';

describe('resolveRobotWorldType', () => {
  it('keeps known fleet types', () => {
    expect(resolveRobotWorldType('DRONE')).toBe('DRONE');
    expect(resolveRobotWorldType('HAULER')).toBe('HAULER');
    expect(resolveRobotWorldType('MINER')).toBe('MINER');
    expect(resolveRobotWorldType('WORKER')).toBe('WORKER');
    expect(resolveRobotWorldType('SCOUT')).toBe('SCOUT');
  });

  it('does not treat unknown types as SCOUT', () => {
    expect(resolveRobotWorldType('PROBE')).toBe('UNKNOWN');
    expect(resolveRobotWorldType('')).toBe('UNKNOWN');
  });
});
