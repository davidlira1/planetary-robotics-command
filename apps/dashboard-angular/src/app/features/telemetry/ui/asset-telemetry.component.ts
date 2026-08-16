import { Component, inject } from '@angular/core';
import { FleetFacade } from '../../fleet/state/fleet-facade';
import { formatNumber, operationalLabel, typeLabel } from '../../../shared/format';
import {
  signalBarPercent,
  temperatureBarPercent,
  velocityBarPercent,
} from './telemetry-bar-scale';

@Component({
  selector: 'prc-asset-telemetry',
  standalone: true,
  templateUrl: './asset-telemetry.component.html',
  styleUrl: './asset-telemetry.component.css',
})
export class AssetTelemetryComponent {
  private readonly fleet = inject(FleetFacade);
  readonly selected = this.fleet.selectedRobot;
  readonly formatNumber = formatNumber;
  readonly typeLabel = typeLabel;
  readonly operationalLabel = operationalLabel;
  readonly signalBarPercent = signalBarPercent;
  readonly temperatureBarPercent = temperatureBarPercent;
  readonly velocityBarPercent = velocityBarPercent;
}
