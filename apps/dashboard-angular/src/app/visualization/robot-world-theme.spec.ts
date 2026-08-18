import { prcColors } from '@prc/design-system/tokens';
import { hexToThreeColor, robotWorldTheme } from './robot-world-theme';

describe('robotWorldTheme', () => {
  it('converts design-system hex colors to Three.js numeric colors', () => {
    expect(hexToThreeColor('#37dcff')).toBe(0x37dcff);
    expect(robotWorldTheme.accent).toBe(hexToThreeColor(prcColors.accentPrimary));
    expect(robotWorldTheme.normal).toBe(hexToThreeColor(prcColors.statusNormal));
    expect(robotWorldTheme.warning).toBe(hexToThreeColor(prcColors.statusWarning));
    expect(robotWorldTheme.critical).toBe(hexToThreeColor(prcColors.statusCritical));
    expect(robotWorldTheme.muted).toBe(hexToThreeColor(prcColors.textMuted));
    expect(robotWorldTheme.background).toBe(hexToThreeColor(prcColors.bgWorld));
    expect(robotWorldTheme.graphite).toBe(hexToThreeColor(prcColors.bgMeterTrack));
  });

  it('rejects invalid hex', () => {
    expect(() => hexToThreeColor('cyan')).toThrow('Invalid hex color');
  });
});
