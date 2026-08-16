export class InitialFitGate {
  private done = false;

  shouldFit(hasPositions: boolean): boolean {
    return !this.done && hasPositions;
  }

  markFitted(): void {
    this.done = true;
  }

  reset(): void {
    this.done = false;
  }
}
