export function handleWorldRobotClick(
  clickedRobotId: string,
  deps: {
    selectedRobotId: string | null;
    selectRobot(id: string): void;
    focusRobot(id: string): void;
    closeInspection(): void;
    toggleAsset(): void;
  },
): void {
  if (clickedRobotId !== deps.selectedRobotId) {
    deps.selectRobot(clickedRobotId);
    deps.closeInspection();
    deps.focusRobot(clickedRobotId);
    return;
  }
  deps.toggleAsset();
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
