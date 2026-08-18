import {
  afterNextRender,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  viewChild,
} from '@angular/core';
import { FleetFacade } from '../features/fleet/state/fleet-facade';
import { InspectionFacade } from '../features/inspection/state/inspection-facade';
import { mapFleetToWorldRobots } from './map-fleet-to-world';
import { provideRobotWorld } from './provide-robot-world';
import { ROBOT_WORLD } from './robot-world.token';
import { focusSelectedRobot, handleWorldRobotClick } from './inspect-world-robot';

@Component({
  selector: 'prc-robot-world-host',
  standalone: true,
  templateUrl: './robot-world-host.component.html',
  styleUrl: './robot-world-host.component.css',
  providers: [provideRobotWorld()],
})
export class RobotWorldHostComponent implements OnDestroy {
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private readonly fleet = inject(FleetFacade);
  private readonly inspection = inject(InspectionFacade);
  private readonly world = inject(ROBOT_WORLD);
  private observer: ResizeObserver | null = null;

  readonly canFocusSelected = computed(() => {
    const id = this.fleet.selectedRobotId();
    if (!id) {
      return false;
    }
    return mapFleetToWorldRobots(this.fleet.robots()).some(
      (robot) => robot.id === id && robot.position !== null,
    );
  });

  constructor() {
    afterNextRender(() => this.boot());
    effect(() => {
      this.world.syncFleet(mapFleetToWorldRobots(this.fleet.robots()));
    });
    effect(() => {
      this.world.setSelectedRobot(this.fleet.selectedRobotId());
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.world.destroy();
  }

  onFitFleet(): void {
    this.world.fitFleet();
  }

  onFocusSelected(): void {
    focusSelectedRobot(this.fleet.selectedRobotId(), this.canFocusSelected(), (id) =>
      this.world.focusRobot(id),
    );
  }

  private boot(): void {
    const host = this.host().nativeElement;
    this.world.initialize(host, {
      onRobotSelected: (id) =>
        handleWorldRobotClick(id, {
          selectedRobotId: this.fleet.selectedRobotId(),
          selectRobot: (robotId) => this.fleet.selectRobot(robotId),
          focusRobot: (robotId) => this.world.focusRobot(robotId),
          closeInspection: () => this.inspection.close(),
          toggleAsset: () => this.inspection.toggleAsset(),
        }),
    });
    this.world.syncFleet(mapFleetToWorldRobots(this.fleet.robots()));
    this.world.setSelectedRobot(this.fleet.selectedRobotId());
    this.observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      const { width, height } = entry.contentRect;
      this.world.resize(width, height);
    });
    this.observer.observe(host);
  }
}
