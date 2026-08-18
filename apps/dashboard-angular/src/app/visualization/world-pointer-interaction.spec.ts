import { findAncestorRobotId, type Object3DLike } from './find-ancestor-robot-id';
import {
  dispatchLabelSelection,
  hoverIdChanged,
  isPointerDrag,
  robotIdFromDataset,
  type DatasetRobotIdNode,
} from './world-pointer-interaction';

function mesh(robotId?: string, parent: Object3DLike | null = null): Object3DLike {
  return {
    userData: robotId === undefined ? {} : { robotId },
    parent,
  };
}

function label(
  robotId?: string,
  extras: { base?: boolean; parent?: DatasetRobotIdNode | null } = {},
): DatasetRobotIdNode {
  return {
    dataset: robotId === undefined ? {} : { robotId },
    classList: {
      contains: (token: string) => extras.base === true && token === 'prc-robot-label--base',
    },
    parentElement: extras.parent ?? null,
  };
}

describe('world pointer interaction', () => {
  it('resolves a robotId from a ray hit and from a nested child', () => {
    expect(findAncestorRobotId(mesh('D-04'))).toBe('D-04');
    const root = mesh('W-08');
    const child = mesh(undefined, root);
    expect(findAncestorRobotId(child)).toBe('W-08');
  });

  it('resolves the same robotId from a label dataset', () => {
    const root = label('D-04');
    const child = label(undefined, { parent: root });
    expect(robotIdFromDataset(root)).toBe('D-04');
    expect(robotIdFromDataset(child)).toBe('D-04');
    expect(robotIdFromDataset(label('D-04'))).toBe(findAncestorRobotId(mesh('D-04')));
  });

  it('ignores the BASE label', () => {
    expect(robotIdFromDataset(label('BASE', { base: true }))).toBeNull();
  });

  it('updates hover only when the robot id changes and clears on leave', () => {
    expect(hoverIdChanged(null, 'D-04')).toBe(true);
    expect(hoverIdChanged('D-04', 'D-04')).toBe(false);
    expect(hoverIdChanged('D-04', 'W-08')).toBe(true);
    expect(hoverIdChanged('D-04', null)).toBe(true);
  });

  it('treats small pointer travel as a click and larger travel as a drag', () => {
    expect(isPointerDrag({ x: 10, y: 10 }, { x: 12, y: 11 })).toBe(false);
    expect(isPointerDrag({ x: 10, y: 10 }, { x: 40, y: 30 })).toBe(true);
  });

  it('routes a label click to one selection callback without a duplicate fire', () => {
    const select = jest.fn();
    const event = { stopPropagation: jest.fn() };
    dispatchLabelSelection(event, 'D-04', select);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledWith('D-04');
  });
});
