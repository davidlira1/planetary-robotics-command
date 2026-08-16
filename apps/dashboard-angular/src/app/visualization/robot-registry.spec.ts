import { syncRegistry } from './robot-registry';

describe('syncRegistry', () => {
  it('creates, updates, and removes incrementally', () => {
    const map = new Map<string, { n: number }>();
    const created: string[] = [];
    const updated: string[] = [];
    const removed: string[] = [];

    const run = (ids: string[]) =>
      syncRegistry(
        ids,
        map,
        (id) => {
          created.push(id);
          return { n: 1 };
        },
        (id, value) => {
          updated.push(id);
          value.n += 1;
        },
        (id) => {
          removed.push(id);
        },
      );

    run(['a', 'b']);
    run(['b', 'c']);

    expect(created).toEqual(['a', 'b', 'c']);
    expect(updated).toEqual(['b']);
    expect(removed).toEqual(['a']);
    expect([...map.keys()]).toEqual(['b', 'c']);
  });
});
