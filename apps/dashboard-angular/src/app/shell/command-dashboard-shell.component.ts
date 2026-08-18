import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActiveAlertsComponent } from '../features/alerts/ui/active-alerts.component';
import { AlertsFacade } from '../features/alerts/state/alerts-facade';
import { AssetTelemetryComponent } from '../features/telemetry/ui/asset-telemetry.component';
import { CommandHeaderComponent } from '../features/header/ui/command-header.component';
import { FleetAssetsComponent } from '../features/fleet/ui/fleet-assets.component';
import { FleetFacade } from '../features/fleet/state/fleet-facade';
import { FleetSummaryMetricsComponent } from '../features/fleet/ui/fleet-summary-metrics.component';
import { InspectionDrawerComponent } from '../features/inspection/ui/inspection-drawer.component';
import { InspectionFacade } from '../features/inspection/state/inspection-facade';
import { OperationsFeedComponent } from '../features/operations/ui/operations-feed.component';
import { RealtimeFacade } from '../features/realtime/state/realtime-facade';
import { RobotWorldHostComponent } from '../visualization/robot-world-host.component';

@Component({
  selector: 'prc-command-dashboard-shell',
  standalone: true,
  imports: [
    CommandHeaderComponent,
    FleetAssetsComponent,
    RobotWorldHostComponent,
    FleetSummaryMetricsComponent,
    AssetTelemetryComponent,
    ActiveAlertsComponent,
    OperationsFeedComponent,
    InspectionDrawerComponent,
  ],
  providers: [FleetFacade, AlertsFacade, InspectionFacade, RealtimeFacade],
  templateUrl: './command-dashboard-shell.component.html',
  styleUrl: './command-dashboard-shell.component.css',
})
export class CommandDashboardShellComponent implements OnInit {
  private readonly fleet = inject(FleetFacade);
  private readonly alerts = inject(AlertsFacade);
  private readonly realtime = inject(RealtimeFacade);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.fleet.loadFleet().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    this.alerts.loadAlerts().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    this.realtime.connect();
  }
}
