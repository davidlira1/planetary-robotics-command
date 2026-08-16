export interface Object3DLike {
  userData: Record<string, unknown>;
  parent: Object3DLike | null;
}

export function findAncestorRobotId(object: Object3DLike | null | undefined): string | null {
  let current = object ?? null;
  while (current) {
    const robotId = current.userData['robotId'];
    if (typeof robotId === 'string' && robotId.length > 0) {
      return robotId;
    }
    current = current.parent;
  }
  return null;
}
