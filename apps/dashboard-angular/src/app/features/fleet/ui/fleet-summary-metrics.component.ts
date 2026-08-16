import { Component, computed, inject } from '@angular/core';
import { AlertsFacade } from '../../alerts/state/alerts-facade';
import { FleetFacade } from '../state/fleet-facade';
import { formatClock, padCount } from '../../../shared/format';

@Component({
  selector: 'prc-fleet-summary-metrics',
  standalone: true,
  templateUrl: './fleet-summary-metrics.component.html',
  styleUrl: './fleet-summary-metrics.component.css',
})
export class FleetSummaryMetricsComponent {
  readonly fleet = inject(FleetFacade);
  readonly alerts = inject(AlertsFacade);
  readonly padCount = padCount;
  readonly formatClock = formatClock;

  readonly total = computed(() => this.fleet.robots().length);
  readonly online = computed(
    () => this.fleet.robots().filter((robot) => robot.operationalStatus !== 'OFFLINE').length,
  );
  readonly avgBattery = computed(() => {
    const withState = this.fleet.robots().filter((robot) => robot.currentState);
    if (withState.length === 0) {
      return '—';
    }
    const sum = withState.reduce((acc, robot) => acc + robot.currentState!.batteryPercent, 0);
    return `${Math.round(sum / withState.length)}%`;
  });
}
