import { Component, computed, inject } from '@angular/core';
import { FleetFacade } from '../../fleet/state/fleet-facade';
import { RealtimeFacade } from '../../realtime/state/realtime-facade';

@Component({
  selector: 'prc-command-header',
  standalone: true,
  templateUrl: './command-header.component.html',
  styleUrl: './command-header.component.css',
})
export class CommandHeaderComponent {
  private readonly fleet = inject(FleetFacade);
  private readonly realtime = inject(RealtimeFacade);

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

  readonly liveState = computed(() => this.realtime.connectionState());
  readonly liveOk = computed(() => this.liveState() === 'CONNECTED');
  readonly liveWarn = computed(
    () => this.liveState() === 'CONNECTING' || this.liveState() === 'RECONNECTING',
  );
  readonly liveBad = computed(() => this.liveState() === 'DISCONNECTED');
  readonly liveLabel = computed(() => {
    switch (this.liveState()) {
      case 'CONNECTING':
        return 'LIVE LINK CONNECTING';
      case 'CONNECTED':
        return 'LIVE LINK CONNECTED';
      case 'RECONNECTING':
        return 'LIVE LINK RECONNECTING';
      default:
        return 'LIVE LINK DISCONNECTED';
    }
  });
}
