import { Component, computed, inject } from '@angular/core';
import { FleetFacade } from '../../fleet/state/fleet-facade';

@Component({
  selector: 'prc-command-header',
  standalone: true,
  templateUrl: './command-header.component.html',
  styleUrl: './command-header.component.css',
})
export class CommandHeaderComponent {
  private readonly fleet = inject(FleetFacade);

  readonly connected = computed(() => this.fleet.loadedAt() !== null && !this.fleet.error());
  readonly failed = computed(() => this.fleet.error() !== null);

  readonly label = computed(() => {
    if (this.fleet.loading() && !this.fleet.loadedAt()) {
      return 'CONNECTING';
    }
    if (this.connected()) {
      return 'API CONNECTED';
    }
    if (this.failed()) {
      return 'API UNREACHABLE';
    }
    return 'API OFFLINE';
  });
}
