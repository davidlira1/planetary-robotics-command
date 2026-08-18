import type { RobotWorldType } from '../robot-world';
import { createDroneVisual } from './drone-model';
import { createHaulerVisual } from './hauler-model';
import { createMinerVisual } from './miner-model';
import { createScoutVisual } from './scout-model';
import { createUnknownVisual } from './unknown-model';
import { createWorkerVisual } from './worker-model';
import type { RobotVisual } from './robot-visual';

export function createRobotVisual(type: RobotWorldType): RobotVisual {
  switch (type) {
    case 'DRONE':
      return createDroneVisual();
    case 'SCOUT':
      return createScoutVisual();
    case 'HAULER':
      return createHaulerVisual();
    case 'MINER':
      return createMinerVisual();
    case 'WORKER':
      return createWorkerVisual();
    case 'UNKNOWN':
      return createUnknownVisual();
  }
}
