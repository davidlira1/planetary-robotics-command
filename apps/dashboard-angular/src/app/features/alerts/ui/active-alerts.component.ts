import { Component, inject } from '@angular/core';
import { AlertsFacade } from '../state/alerts-facade';
import { FleetFacade } from '../../fleet/state/fleet-facade';
import { InspectionFacade } from '../../inspection/state/inspection-facade';
import { alertTypeLabel } from '../../../shared/format';

@Component({
  selector: 'prc-active-alerts',
  standalone: true,
  templateUrl: './active-alerts.component.html',
  styleUrl: './active-alerts.component.css',
})
export class ActiveAlertsComponent {
  readonly alerts = inject(AlertsFacade);
  private readonly fleet = inject(FleetFacade);
  private readonly inspection = inject(InspectionFacade);
  readonly alertTypeLabel = alertTypeLabel;

  pad(value: number): string {
    return value.toString().padStart(2, '0');
  }

  onAlertClick(alertId: string, robotId: string): void {
    this.fleet.selectRobot(robotId);
    this.inspection.openAlert(alertId);
  }
}
