import { findAncestorRobotId, type Object3DLike } from './find-ancestor-robot-id';

function node(robotId?: string, parent: Object3DLike | null = null): Object3DLike {
  return {
    userData: robotId === undefined ? {} : { robotId },
    parent,
  };
}

describe('findAncestorRobotId', () => {
  it('reads robotId from the hit object', () => {
    expect(findAncestorRobotId(node('D-04'))).toBe('D-04');
  });

  it('walks parents past nested meshes', () => {
    const root = node('W-08');
    const mid = node(undefined, root);
    const leaf = node(undefined, mid);
    expect(findAncestorRobotId(leaf)).toBe('W-08');
  });

  it('ignores empty or non-string robotId values', () => {
    const root = node('D-04');
    const mid: Object3DLike = { userData: { robotId: '' }, parent: root };
    const other: Object3DLike = { userData: { robotId: 12 }, parent: mid };
    expect(findAncestorRobotId(other)).toBe('D-04');
  });

  it('returns null when no ancestor has a robotId', () => {
    expect(findAncestorRobotId(node())).toBeNull();
    expect(findAncestorRobotId(null)).toBeNull();
  });
});
