import { lerpHeadingDegrees } from './heading';
import type { Vec3 } from './fleet-bounds';

/** Presentation lag so a later sample is often available; HOLD covers remaining gaps. */
export const INTERPOLATION_DELAY_MS = 1800;
const MAX_SAMPLES = 16;
const MAX_AGE_MS = 4000;

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

  poseAt(renderTimeMs: number): InterpolatedPose | null {
    if (this.samples.length === 0) {
      return null;
    }
    const oldest = this.samples[0]!;
    const newest = this.samples[this.samples.length - 1]!;
    if (this.samples.length === 1 || renderTimeMs >= newest.recordedAtMs) {
      return copyPose(newest);
    }
    if (renderTimeMs <= oldest.recordedAtMs) {
      return copyPose(oldest);
    }
    for (let i = 0; i < this.samples.length - 1; i += 1) {
      const sampleA = this.samples[i]!;
      const sampleB = this.samples[i + 1]!;
      if (sampleA.recordedAtMs <= renderTimeMs && renderTimeMs <= sampleB.recordedAtMs) {
        const span = sampleB.recordedAtMs - sampleA.recordedAtMs;
        const t = span <= 0 ? 0 : (renderTimeMs - sampleA.recordedAtMs) / span;
        return {
          position: lerpVec(sampleA.position, sampleB.position, t),
          headingDegrees: lerpHeadingDegrees(sampleA.headingDegrees, sampleB.headingDegrees, t),
          velocityMetersPerSecond:
            sampleA.velocityMetersPerSecond +
            (sampleB.velocityMetersPerSecond - sampleA.velocityMetersPerSecond) * t,
        };
      }
    }
    return copyPose(newest);
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
