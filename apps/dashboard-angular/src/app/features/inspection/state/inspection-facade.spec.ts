import { InspectionFacade } from './inspection-facade';

function expectReadonlySignal(value: object): void {
  expect(value).not.toHaveProperty('set');
  expect(value).not.toHaveProperty('update');
}

describe('InspectionFacade', () => {
  it('exposes read-only signals', () => {
    const facade = new InspectionFacade();
    expectReadonlySignal(facade.mode);
    expectReadonlySignal(facade.selectedAlertId);
  });

  it('opens asset mode and clears selectedAlertId', () => {
    const facade = new InspectionFacade();
    facade.openAlert('a1');
    facade.openAsset();
    expect(facade.mode()).toBe('asset');
    expect(facade.selectedAlertId()).toBeNull();
  });

  it('opens alert mode with the alert id', () => {
    const facade = new InspectionFacade();
    facade.openAlert('a1');
    expect(facade.mode()).toBe('alert');
    expect(facade.selectedAlertId()).toBe('a1');
  });

  it('toggles asset mode on and off without storing a robot id', () => {
    const facade = new InspectionFacade();
    facade.toggleAsset();
    expect(facade.mode()).toBe('asset');
    expect(facade.selectedAlertId()).toBeNull();
    facade.toggleAsset();
    expect(facade.mode()).toBeNull();
  });

  it('replaces an open alert drawer when toggling asset', () => {
    const facade = new InspectionFacade();
    facade.openAlert('a1');
    facade.toggleAsset();
    expect(facade.mode()).toBe('asset');
    expect(facade.selectedAlertId()).toBeNull();
  });

  it('closes and clears mode and selected alert', () => {
    const facade = new InspectionFacade();
    facade.openAlert('a1');
    facade.close();
    expect(facade.mode()).toBeNull();
    expect(facade.selectedAlertId()).toBeNull();
  });
});
