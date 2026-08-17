import { reconnectDelayMs } from './reconnect-delay';

describe('reconnectDelayMs', () => {
  const noJitter = () => 0;

  it('follows 500ms doubling up to an 8s cap', () => {
    expect(reconnectDelayMs(0, noJitter)).toBe(500);
    expect(reconnectDelayMs(1, noJitter)).toBe(1000);
    expect(reconnectDelayMs(2, noJitter)).toBe(2000);
    expect(reconnectDelayMs(3, noJitter)).toBe(4000);
    expect(reconnectDelayMs(4, noJitter)).toBe(8000);
    expect(reconnectDelayMs(8, noJitter)).toBe(8000);
  });
});
