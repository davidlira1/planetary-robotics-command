export function reconnectDelayMs(attempt: number, random: () => number = Math.random): number {
  const exponent = Math.max(0, attempt);
  const base = Math.min(8000, 500 * 2 ** exponent);
  return base + base * 0.2 * random();
}
