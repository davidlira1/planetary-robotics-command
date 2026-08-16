import { InitialFitGate } from './initial-fit-gate';

describe('InitialFitGate', () => {
  it('fits once only after a real positioned fit is marked complete', () => {
    const gate = new InitialFitGate();
    expect(gate.shouldFit(false)).toBe(false);
    expect(gate.shouldFit(true)).toBe(true);
    expect(gate.shouldFit(true)).toBe(true);
    gate.markFitted();
    expect(gate.shouldFit(true)).toBe(false);
  });

  it('allows another initial fit after reset', () => {
    const gate = new InitialFitGate();
    expect(gate.shouldFit(true)).toBe(true);
    gate.markFitted();
    gate.reset();
    expect(gate.shouldFit(true)).toBe(true);
  });
});
