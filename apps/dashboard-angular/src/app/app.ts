import { Component } from '@angular/core';
import { CommandDashboardShellComponent } from './shell/command-dashboard-shell.component';

@Component({
  selector: 'prc-root',
  standalone: true,
  imports: [CommandDashboardShellComponent],
  template: '<prc-command-dashboard-shell />',
})
export class App {}
