import { FleetReadRepository } from '../ports/fleet-read-repository';
import { FleetSnapshot } from '../read-models/fleet';

export class GetFleetSnapshot {
  constructor(private readonly fleet: FleetReadRepository) {}

  async execute(): Promise<FleetSnapshot> {
    return this.fleet.getSnapshot();
  }
}
