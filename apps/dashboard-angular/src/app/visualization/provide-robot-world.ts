import type { Provider } from '@angular/core';
import { ROBOT_WORLD } from './robot-world.token';
import { ThreeRobotWorld } from './three-robot-world';

export function provideRobotWorld(): Provider {
  return { provide: ROBOT_WORLD, useFactory: () => new ThreeRobotWorld() };
}
