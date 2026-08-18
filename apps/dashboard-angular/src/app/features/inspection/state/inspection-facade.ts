import { Injectable, signal } from '@angular/core';

export type InspectionMode = 'asset' | 'alert' | null;

@Injectable()
export class InspectionFacade {
  private readonly _mode = signal<InspectionMode>(null);
  readonly mode = this._mode.asReadonly();

  private readonly _selectedAlertId = signal<string | null>(null);
  readonly selectedAlertId = this._selectedAlertId.asReadonly();

  openAsset(): void {
    this._selectedAlertId.set(null);
    this._mode.set('asset');
  }

  toggleAsset(): void {
    if (this._mode() === 'asset') {
      this.close();
      return;
    }
    this.openAsset();
  }

  openAlert(alertId: string): void {
    this._selectedAlertId.set(alertId);
    this._mode.set('alert');
  }

  close(): void {
    this._mode.set(null);
    this._selectedAlertId.set(null);
  }
}
