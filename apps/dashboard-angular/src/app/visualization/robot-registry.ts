export interface RegistryEntry<T> {
  id: string;
  value: T;
}

export function syncRegistry<T>(
  currentIds: readonly string[],
  existing: Map<string, T>,
  create: (id: string) => T,
  update: (id: string, value: T) => void,
  remove: (id: string, value: T) => void,
): void {
  const incoming = new Set(currentIds);
  for (const [id, value] of existing) {
    if (!incoming.has(id)) {
      remove(id, value);
      existing.delete(id);
    }
  }
  for (const id of currentIds) {
    const value = existing.get(id);
    if (value) {
      update(id, value);
    } else {
      existing.set(id, create(id));
    }
  }
}
