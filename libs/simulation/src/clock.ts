import { ulid } from 'ulid';

/** Wall clock for recordedAt timestamps. */
export interface WallClock {
  now(): Date;
}

/** Monotonic clock for physics deltaTime (milliseconds). */
export interface MonotonicClock {
  nowMs(): number;
}

export interface IdGenerator {
  nextId(): string;
}

export const systemWallClock: WallClock = {
  now: () => new Date(),
};

export const systemMonotonicClock: MonotonicClock = {
  nowMs: () => performance.now(),
};

export function fixedWallClock(iso: string): WallClock {
  const fixed = new Date(iso);
  return { now: () => new Date(fixed.getTime()) };
}

export function sequenceWallClock(timestamps: string[]): WallClock {
  let i = 0;
  return {
    now() {
      const iso = timestamps[Math.min(i, timestamps.length - 1)]!;
      i += 1;
      return new Date(iso);
    },
  };
}

export function sequenceIdGenerator(ids: string[]): IdGenerator {
  let i = 0;
  return {
    nextId() {
      const id = ids[Math.min(i, ids.length - 1)]!;
      i += 1;
      return id;
    },
  };
}

export function ulidIdGenerator(createUlid: () => string = ulid): IdGenerator {
  return { nextId: () => createUlid() };
}
