import { lerpHeadingDegrees } from './heading';
import type { Vec3 } from './fleet-bounds';

/** ~1s past the 2s telemetry cadence so a future sample is usually present; HOLD covers remaining gaps. */
export const INTERPOLATION_DELAY_MS = 3000;
const MAX_SAMPLES = 16;
/** Relative to newest sample recordedAt, not wall-clock. Covers 3000ms delay + 2s cadence + jitter. */
export const MAX_AGE_MS = 8000;
/** Temporary: throttled pose/cadence logs for one robot. Turn off after diagnosis. */
export const INTERPOLATION_DIAGNOSTICS = true;

export type PoseMode = 'SINGLE_SAMPLE' | 'HOLD' | 'CLAMP_OLDEST' | 'INTERPOLATE';

export interface PoseInspection {
  mode: PoseMode;
  t: number | null;
  previousRecordedAtMs: number | null;
  newestRecordedAtMs: number | null;
  oldestRecordedAtMs: number | null;
  sampleCount: number;
}

export interface MotionSample {
  recordedAtMs: number;
  position: Vec3;
  headingDegrees: number;
  velocityMetersPerSecond: number;
}

export interface InterpolatedPose {
  position: Vec3;
  headingDegrees: number;
  velocityMetersPerSecond: number;
}

export class InterpolationBuffer {
  private readonly samples: MotionSample[] = [];

  get size(): number {
    return this.samples.length;
  }

  push(sample: MotionSample): boolean {
    const newest = this.samples[this.samples.length - 1];
    if (newest && sample.recordedAtMs <= newest.recordedAtMs) {
      return false;
    }
    this.samples.push({
      recordedAtMs: sample.recordedAtMs,
      position: { ...sample.position },
      headingDegrees: sample.headingDegrees,
      velocityMetersPerSecond: sample.velocityMetersPerSecond,
    });
    this.prune(sample.recordedAtMs);
    return true;
  }

  inspectPoseAt(renderTimeMs: number): PoseInspection | null {
    const located = this.locate(renderTimeMs);
    if (!located) {
      return null;
    }
    const newest = this.samples[this.samples.length - 1]!;
    const oldest = this.samples[0]!;
    const previous = this.samples.length > 1 ? this.samples[this.samples.length - 2]! : null;
    return {
      mode: located.mode,
      t: located.t,
      previousRecordedAtMs: located.sampleA?.recordedAtMs ?? previous?.recordedAtMs ?? null,
      newestRecordedAtMs: newest.recordedAtMs,
      oldestRecordedAtMs: oldest.recordedAtMs,
      sampleCount: this.samples.length,
    };
  }

  poseAt(renderTimeMs: number): InterpolatedPose | null {
    const located = this.locate(renderTimeMs);
    if (!located) {
      return null;
    }
    if (located.mode === 'INTERPOLATE' && located.sampleA && located.sampleB) {
      const t = located.t ?? 0;
      return {
        position: lerpVec(located.sampleA.position, located.sampleB.position, t),
        headingDegrees: lerpHeadingDegrees(
          located.sampleA.headingDegrees,
          located.sampleB.headingDegrees,
          t,
        ),
        velocityMetersPerSecond:
          located.sampleA.velocityMetersPerSecond +
          (located.sampleB.velocityMetersPerSecond - located.sampleA.velocityMetersPerSecond) * t,
      };
    }
    const held = located.sampleB ?? located.sampleA;
    return held ? copyPose(held) : null;
  }

  private locate(renderTimeMs: number): {
    mode: PoseMode;
    t: number | null;
    sampleA: MotionSample | null;
    sampleB: MotionSample | null;
  } | null {
    if (this.samples.length === 0) {
      return null;
    }
    const oldest = this.samples[0]!;
    const newest = this.samples[this.samples.length - 1]!;
    if (this.samples.length === 1) {
      return { mode: 'SINGLE_SAMPLE', t: null, sampleA: newest, sampleB: null };
    }
    if (renderTimeMs >= newest.recordedAtMs) {
      return { mode: 'HOLD', t: null, sampleA: newest, sampleB: newest };
    }
    if (renderTimeMs <= oldest.recordedAtMs) {
      return { mode: 'CLAMP_OLDEST', t: null, sampleA: oldest, sampleB: oldest };
    }
    for (let i = 0; i < this.samples.length - 1; i += 1) {
      const sampleA = this.samples[i]!;
      const sampleB = this.samples[i + 1]!;
      if (sampleA.recordedAtMs <= renderTimeMs && renderTimeMs <= sampleB.recordedAtMs) {
        const span = sampleB.recordedAtMs - sampleA.recordedAtMs;
        const t = span <= 0 ? 0 : (renderTimeMs - sampleA.recordedAtMs) / span;
        return { mode: 'INTERPOLATE', t, sampleA, sampleB };
      }
    }
    return { mode: 'HOLD', t: null, sampleA: newest, sampleB: newest };
  }

  private prune(newestRecordedAtMs: number): void {
    const cutoff = newestRecordedAtMs - MAX_AGE_MS;
    while (this.samples.length > 2 && this.samples[0]!.recordedAtMs < cutoff) {
      this.samples.shift();
    }
    while (this.samples.length > MAX_SAMPLES) {
      this.samples.shift();
    }
  }
}

function copyPose(sample: MotionSample): InterpolatedPose {
  return {
    position: { ...sample.position },
    headingDegrees: sample.headingDegrees,
    velocityMetersPerSecond: sample.velocityMetersPerSecond,
  };
}

function lerpVec(from: Vec3, to: Vec3, t: number): Vec3 {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    z: from.z + (to.z - from.z) * t,
  };
}
