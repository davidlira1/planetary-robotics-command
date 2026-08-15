/**
 * Mulberry32 seeded PRNG — deterministic given the same seed sequence.
 */
export interface Rng {
  next(): number;
  nextRange(min: number, max: number): number;
  nextSigned(magnitude: number): number;
}

export function createSeededRng(seed: number): Rng {
  let state = seed >>> 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    nextRange(min: number, max: number) {
      return min + this.next() * (max - min);
    },
    nextSigned(magnitude: number) {
      return (this.next() * 2 - 1) * magnitude;
    },
  };
}

export function createRandomSeed(): number {
  return (Date.now() ^ (Math.floor(Math.random() * 0xffffffff) >>> 0)) >>> 0;
}
