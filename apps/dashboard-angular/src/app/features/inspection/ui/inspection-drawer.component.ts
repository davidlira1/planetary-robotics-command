import {
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  inject,
  viewChild,
} from '@angular/core';
import { AlertsFacade } from '../../alerts/state/alerts-facade';
import { FleetFacade } from '../../fleet/state/fleet-facade';
import { InspectionFacade } from '../state/inspection-facade';
import { alertTypeLabel, typeLabel } from '../../../shared/format';
import { alertInspectionCards, assetInspectionCards } from './inspection-card';

@Component({
  selector: 'prc-inspection-drawer',
  standalone: true,
  templateUrl: './inspection-drawer.component.html',
  styleUrl: './inspection-drawer.component.css',
})
export class InspectionDrawerComponent {
  readonly inspection = inject(InspectionFacade);
  private readonly fleet = inject(FleetFacade);
  private readonly alerts = inject(AlertsFacade);
  private readonly closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeButton');
  private previousFocus: HTMLElement | null = null;
  private wasOpen = false;

  readonly open = computed(() => this.inspection.mode() !== null);
  readonly selected = this.fleet.selectedRobot;
  readonly alert = computed(
    () => this.alerts.alerts().find((item) => item.id === this.inspection.selectedAlertId()) ?? null,
  );

  readonly kicker = computed(() =>
    this.inspection.mode() === 'alert' ? 'ALERT DETAIL' : 'ASSET INSPECTOR',
  );

  readonly title = computed(() => {
    if (this.inspection.mode() === 'alert') {
      const alert = this.alert();
      return alert ? alertTypeLabel(alert.type) : 'Alert';
    }
    return this.selected()?.id ?? 'Asset';
  });

  readonly lead = computed(() => {
    if (this.inspection.mode() === 'alert') {
      return this.alert()?.message ?? 'Alert detail from the loaded open-alert snapshot.';
    }
    const robot = this.selected();
    if (!robot) {
      return 'No robot selected.';
    }
    return `${typeLabel(robot)} // detailed operational view`;
  });

  readonly cards = computed(() =>
    this.inspection.mode() === 'alert'
      ? alertInspectionCards(this.alert())
      : assetInspectionCards(this.selected()),
  );

  constructor() {
    effect(() => {
      const isOpen = this.open();
      if (isOpen && !this.wasOpen) {
        const active = document.activeElement;
        this.previousFocus = active instanceof HTMLElement ? active : null;
        queueMicrotask(() => this.closeButton()?.nativeElement.focus());
      } else if (!isOpen && this.wasOpen) {
        const restore = this.previousFocus;
        this.previousFocus = null;
        queueMicrotask(() => restore?.focus());
      }
      this.wasOpen = isOpen;
    });
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.inspection.close();
    }
  }

  onDrawerKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !this.open()) {
      return;
    }
    const root = (event.currentTarget as HTMLElement | null) ?? null;
    if (!root) {
      return;
    }
    const focusable = [
      ...root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ].filter((element) => !element.hasAttribute('disabled'));
    if (focusable.length === 0) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) {
      this.inspection.close();
    }
  }
}
