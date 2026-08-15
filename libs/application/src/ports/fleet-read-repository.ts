import { FleetSnapshot } from '../read-models/fleet';

export interface FleetReadRepository {
  /** All robots with current state and health, ordered by id ASC. */
  getSnapshot(): Promise<FleetSnapshot>;
}
