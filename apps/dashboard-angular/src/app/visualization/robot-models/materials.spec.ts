import { ResourceBag } from './resources';
import {
  applyHealthToBeacon,
  applyHoverHighlight,
  BODY_METALNESS,
  BODY_ROUGHNESS,
  createBeaconMaterial,
  createBodyMaterial,
  createDarkMetalMaterial,
  HOVER_HULL_EMISSIVE,
} from './materials';
import { robotWorldTheme } from '../robot-world-theme';

describe('robot materials', () => {
  it('uses steel PBR values in the brushed-metal band', () => {
    const resources = new ResourceBag();
    const body = createBodyMaterial(resources);
    expect(body.color.getHex()).toBe(robotWorldTheme.metal);
    expect(BODY_METALNESS).toBeGreaterThanOrEqual(0.65);
    expect(BODY_METALNESS).toBeLessThanOrEqual(0.8);
    expect(BODY_ROUGHNESS).toBeGreaterThanOrEqual(0.25);
    expect(BODY_ROUGHNESS).toBeLessThanOrEqual(0.4);
    expect(body.metalness).toBe(BODY_METALNESS);
    expect(body.roughness).toBe(BODY_ROUGHNESS);
    resources.dispose();
  });

  it('does not use health colors for the hull or dark metal', () => {
    const resources = new ResourceBag();
    const body = createBodyMaterial(resources);
    const dark = createDarkMetalMaterial(resources);
    const hull = body.color.getHex();
    expect(hull).not.toBe(robotWorldTheme.normal);
    expect(hull).not.toBe(robotWorldTheme.warning);
    expect(hull).not.toBe(robotWorldTheme.critical);
    expect(dark.color.getHex()).toBe(robotWorldTheme.metalDark);
    expect(dark.color.getHex()).not.toBe(robotWorldTheme.surface);
    resources.dispose();
  });

  it('applies a steel hover highlight without painting health or cyan on the hull', () => {
    const resources = new ResourceBag();
    const body = createBodyMaterial(resources);
    const beacon = createBeaconMaterial(resources);
    applyHealthToBeacon(beacon, 'WARNING');
    applyHoverHighlight(body, true, false);
    expect(body.emissive.getHex()).toBe(robotWorldTheme.metal);
    expect(body.emissiveIntensity).toBe(HOVER_HULL_EMISSIVE);
    expect(body.color.getHex()).toBe(robotWorldTheme.metal);
    expect(beacon.emissive.getHex()).toBe(robotWorldTheme.warning);
    applyHoverHighlight(body, true, true);
    expect(body.emissiveIntensity).toBe(0);
    resources.dispose();
  });
});
