import {
  INTERPOLATION_DELAY_MS,
  InterpolationBuffer,
  MAX_AGE_MS,
  type MotionSample,
} from './interpolation-buffer';

const A: MotionSample = {
  recordedAtMs: 1_000,
  position: { x: 0, y: 10, z: 0 },
  headingDegrees: 350,
  velocityMetersPerSecond: 0,
};

const B: MotionSample = {
  recordedAtMs: 2_000,
  position: { x: 10, y: 10, z: 10 },
  headingDegrees: 10,
  velocityMetersPerSecond: 4,
};

function sample(recordedAtMs: number, x = recordedAtMs): MotionSample {
  return {
    recordedAtMs,
    position: { x, y: 0, z: 0 },
    headingDegrees: 0,
    velocityMetersPerSecond: 1,
  };
}

describe('INTERPOLATION_DELAY_MS', () => {
  it('stays 1s past the 2s telemetry cadence', () => {
    expect(INTERPOLATION_DELAY_MS).toBe(3000);
  });
});

describe('InterpolationBuffer', () => {
  it('renders the first sample immediately and holds until a future sample exists', () => {
    const buffer = new InterpolationBuffer();
    expect(buffer.poseAt(0)).toBeNull();
    expect(buffer.push(A)).toBe(true);
    expect(buffer.poseAt(A.recordedAtMs - 500)?.position).toEqual(A.position);
    expect(buffer.poseAt(A.recordedAtMs)?.position).toEqual(A.position);
    expect(buffer.poseAt(A.recordedAtMs + 500)?.position).toEqual(A.position);
  });

  it('interpolates the midpoint between two samples, including shortest-path heading', () => {
    const buffer = new InterpolationBuffer();
    buffer.push(A);
    buffer.push(B);
    const mid = buffer.poseAt(1_500);
    expect(mid?.position.x).toBeCloseTo(5);
    expect(mid?.position.y).toBeCloseTo(10);
    expect(mid?.position.z).toBeCloseTo(5);
    expect(mid?.headingDegrees).toBeCloseTo(0);
    expect(mid?.velocityMetersPerSecond).toBeCloseTo(2);
  });

  it('returns the same pose for the same renderTime regardless of how often it is queried', () => {
    const buffer = new InterpolationBuffer();
    buffer.push(A);
    buffer.push(B);
    const first = buffer.poseAt(1_250);
    const second = buffer.poseAt(1_250);
    expect(second).toEqual(first);
  });

  it('never moves past the newest sample when renderTime is ahead', () => {
    const buffer = new InterpolationBuffer();
    buffer.push(A);
    buffer.push(B);
    const held = buffer.poseAt(B.recordedAtMs + 5_000);
    expect(held?.position).toEqual(B.position);
    expect(held?.headingDegrees).toBe(B.headingDegrees);
  });

  it('rejects duplicate and older recordedAt samples', () => {
    const buffer = new InterpolationBuffer();
    expect(buffer.push(A)).toBe(true);
    expect(buffer.push(A)).toBe(false);
    expect(buffer.push({ ...A, recordedAtMs: A.recordedAtMs - 1, position: { x: 99, y: 0, z: 0 } })).toBe(false);
    expect(buffer.size).toBe(1);
    expect(buffer.poseAt(A.recordedAtMs)?.position).toEqual(A.position);
  });

  it('stays bounded when many samples arrive', () => {
    const buffer = new InterpolationBuffer();
    for (let i = 0; i < 40; i += 1) {
      buffer.push(sample(i * 1_000, i));
    }
    expect(buffer.size).toBeLessThanOrEqual(16);
    expect(buffer.size).toBeGreaterThanOrEqual(2);
  });

  it('interpolates 2s samples without HOLD while a future sample exists', () => {
    const buffer = new InterpolationBuffer();
    const t0 = 10_000;
    buffer.push(sample(t0, 0));
    buffer.push(sample(t0 + 2_000, 20));
    const pose = buffer.poseAt(t0 + 500);
    expect(pose?.position.x).toBeCloseTo(5);
    expect(pose?.position.x).not.toBe(20);
    const later = buffer.poseAt(t0 + 1_500);
    expect(later?.position.x).toBeCloseTo(15);
  });

  it('inspectPoseAt reports SINGLE_SAMPLE, HOLD, INTERPOLATE, and CLAMP_OLDEST', () => {
    const buffer = new InterpolationBuffer();
    expect(buffer.inspectPoseAt(0)).toBeNull();
    buffer.push(sample(1_000, 0));
    expect(buffer.inspectPoseAt(1_500)?.mode).toBe('SINGLE_SAMPLE');
    buffer.push(sample(3_000, 10));
    expect(buffer.inspectPoseAt(3_000)?.mode).toBe('HOLD');
    expect(buffer.inspectPoseAt(4_000)?.mode).toBe('HOLD');
    const mid = buffer.inspectPoseAt(2_000);
    expect(mid?.mode).toBe('INTERPOLATE');
    expect(mid?.t).toBeCloseTo(0.5);
    expect(buffer.inspectPoseAt(500)?.mode).toBe('CLAMP_OLDEST');
  });

  it('keeps the prior 2s sample needed by a 3000ms delayed renderTime', () => {
    const buffer = new InterpolationBuffer();
    buffer.push(sample(0, 0));
    buffer.push(sample(2_000, 20));
    buffer.push(sample(4_000, 40));
    buffer.push(sample(6_000, 60));
    const renderTime = 6_000 - INTERPOLATION_DELAY_MS;
    const inspect = buffer.inspectPoseAt(renderTime);
    expect(inspect?.mode).toBe('INTERPOLATE');
    expect(inspect?.oldestRecordedAtMs).toBeLessThanOrEqual(renderTime);
    expect(buffer.poseAt(renderTime)?.position.x).toBeCloseTo(30);
  });

  it('does not prune the prior sample when 2s cadence has 2400ms jitter', () => {
    const buffer = new InterpolationBuffer();
    buffer.push(sample(0, 0));
    buffer.push(sample(2_400, 24));
    buffer.push(sample(4_800, 48));
    const renderTime = 4_800 - INTERPOLATION_DELAY_MS;
    expect(MAX_AGE_MS).toBeGreaterThanOrEqual(INTERPOLATION_DELAY_MS + 2_400);
    const inspect = buffer.inspectPoseAt(renderTime);
    expect(inspect?.mode).toBe('INTERPOLATE');
    expect(inspect?.mode).not.toBe('CLAMP_OLDEST');
    const pose = buffer.poseAt(renderTime);
    expect(pose?.position.x).toBeCloseTo(18);
    expect(pose?.position.x).not.toBe(24);
  });

  it('HOLDs only when renderTime is at or after the newest sample', () => {
    const buffer = new InterpolationBuffer();
    buffer.push(sample(0, 0));
    buffer.push(sample(2_000, 20));
    expect(buffer.inspectPoseAt(1_999)?.mode).toBe('INTERPOLATE');
    expect(buffer.inspectPoseAt(2_000)?.mode).toBe('HOLD');
    expect(buffer.poseAt(2_500)?.position.x).toBe(20);
  });
});
