export function inspectWorldRobot(
  robotId: string,
  deps: {
    selectRobot(id: string): void;
    focusRobot(id: string): void;
    openAsset(): void;
  },
): void {
  deps.selectRobot(robotId);
  deps.focusRobot(robotId);
  deps.openAsset();
}

export function focusSelectedRobot(
  robotId: string | null,
  canFocus: boolean,
  focusRobot: (id: string) => void,
): void {
  if (!robotId || !canFocus) {
    return;
  }
  focusRobot(robotId);
}
