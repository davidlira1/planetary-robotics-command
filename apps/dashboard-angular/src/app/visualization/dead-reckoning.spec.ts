import { PREDICTION_HORIZON_SECONDS, predictGroundOffset, predictedPosition } from './dead-reckoning';

describe('predictGroundOffset', () => {
  it('does not move when velocity is zero', () => {
    expect(predictGroundOffset(0, 90, 1)).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('advances +Z at heading 0 by velocity × time', () => {
    const offset = predictGroundOffset(8, 0, 0.5);
    expect(offset.x).toBeCloseTo(0);
    expect(offset.y).toBe(0);
    expect(offset.z).toBeCloseTo(4);
  });

  it('advances +X at heading 90 by velocity × time', () => {
    const offset = predictGroundOffset(2, 90, 1);
    expect(offset.x).toBeCloseTo(2);
    expect(offset.y).toBe(0);
    expect(offset.z).toBeCloseTo(0);
  });

  it('stops integrating at the prediction horizon', () => {
    const atHorizon = predictGroundOffset(4, 0, PREDICTION_HORIZON_SECONDS);
    const pastHorizon = predictGroundOffset(4, 0, PREDICTION_HORIZON_SECONDS + 5);
    expect(pastHorizon).toEqual(atHorizon);
    expect(atHorizon.z).toBeCloseTo(4 * PREDICTION_HORIZON_SECONDS);
  });

  it('is frame-rate independent for the same elapsed time', () => {
    const oneStep = predictGroundOffset(6, 90, 1);
    const twoHalfSteps = predictGroundOffset(6, 90, 0.5 + 0.5);
    expect(twoHalfSteps.x).toBeCloseTo(oneStep.x);
  });
});

describe('predictedPosition', () => {
  it('keeps authoritative Y and resets offset when elapsed is 0', () => {
    const start = { x: 10, y: 60, z: -4 };
    expect(predictedPosition(start, 8, 0, 0)).toEqual(start);
    const next = predictedPosition(start, 8, 0, 1);
    expect(next.y).toBe(60);
    expect(next.z).toBeCloseTo(4);
  });
});
