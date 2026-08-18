export const POINTER_DRAG_THRESHOLD_PX = 5;

export type LabelInteract =
  | { type: 'enter' | 'leave'; robotId: string }
  | { type: 'click'; robotId: string; event: { stopPropagation(): void } };

export interface PointerPoint {
  x: number;
  y: number;
}

export interface DatasetRobotIdNode {
  dataset?: { robotId?: string };
  getAttribute?(name: string): string | null;
  classList?: { contains(token: string): boolean };
  parentElement: DatasetRobotIdNode | null;
}

export function robotIdFromDataset(node: DatasetRobotIdNode | null | undefined): string | null {
  let current = node ?? null;
  while (current) {
    if (current.classList?.contains('prc-robot-label--base')) {
      return null;
    }
    const robotId = current.dataset?.robotId ?? current.getAttribute?.('data-robot-id');
    if (typeof robotId === 'string' && robotId.length > 0) {
      return robotId;
    }
    current = current.parentElement;
  }
  return null;
}

export function isPointerDrag(
  down: PointerPoint,
  up: PointerPoint,
  thresholdPx = POINTER_DRAG_THRESHOLD_PX,
): boolean {
  return Math.hypot(up.x - down.x, up.y - down.y) > thresholdPx;
}

export function hoverIdChanged(previous: string | null, next: string | null): boolean {
  return previous !== next;
}

export function dispatchLabelSelection(
  event: { stopPropagation(): void },
  robotId: string | null,
  select: (id: string) => void,
): void {
  event.stopPropagation();
  if (!robotId) {
    return;
  }
  select(robotId);
}
