import { ROBOT_WORLD_TYPES } from '../robot-world';
import { createRobotVisual } from './create-robot-visual';

describe('createRobotVisual', () => {
  it('creates a distinct visual for every known type and UNKNOWN', () => {
    for (const type of [...ROBOT_WORLD_TYPES, 'UNKNOWN'] as const) {
      const visual = createRobotVisual(type);
      expect(visual.group.children.length).toBeGreaterThan(0);
      expect(() => visual.dispose()).not.toThrow();
    }
  });

  it('uses the UNKNOWN fallback for unrecognized types at the factory boundary', () => {
    const visual = createRobotVisual('UNKNOWN');
    visual.updateVisualState({ healthStatus: 'HEALTHY', selected: true, hovered: false });
    visual.tick(0.016, { velocityMetersPerSecond: 0 });
    visual.dispose();
  });
});
