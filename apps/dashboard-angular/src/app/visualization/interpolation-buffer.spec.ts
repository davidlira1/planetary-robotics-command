import { INTERPOLATION_DELAY_MS, InterpolationBuffer, type MotionSample } from './interpolation-buffer';

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
  it('stays at 1800 ms of presentation lag', () => {
    expect(INTERPOLATION_DELAY_MS).toBe(1800);
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
});
