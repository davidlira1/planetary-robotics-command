import { InjectionToken } from '@angular/core';
import type { RobotWorld } from './robot-world';

export const ROBOT_WORLD = new InjectionToken<RobotWorld>('RobotWorld');
