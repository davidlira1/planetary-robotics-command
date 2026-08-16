import { Component, computed, inject } from '@angular/core';
import { FleetFacade } from '../state/fleet-facade';
import { padCount, robotAccessibleName, typeBadge, typeLabel } from '../../../shared/format';

@Component({
  selector: 'prc-fleet-assets',
  standalone: true,
  templateUrl: './fleet-assets.component.html',
  styleUrl: './fleet-assets.component.css',
})
export class FleetAssetsComponent {
  readonly fleet = inject(FleetFacade);
  readonly typeBadge = typeBadge;
  readonly typeLabel = typeLabel;
  readonly robotAccessibleName = robotAccessibleName;
  readonly padCount = padCount;

  readonly onlineCount = computed(
    () => this.fleet.robots().filter((robot) => robot.operationalStatus !== 'OFFLINE').length,
  );
}
