import { prcColors } from '@prc/design-system/tokens';

export function hexToThreeColor(hex: string): number {
  const value = hex.startsWith('#') ? hex.slice(1) : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return Number.parseInt(value, 16);
}

/** Renderer-specific numeric colors derived from @prc/design-system. */
export const robotWorldTheme = {
  accent: hexToThreeColor(prcColors.accentPrimary),
  normal: hexToThreeColor(prcColors.statusNormal),
  warning: hexToThreeColor(prcColors.statusWarning),
  critical: hexToThreeColor(prcColors.statusCritical),
  muted: hexToThreeColor(prcColors.textMuted),
  background: hexToThreeColor(prcColors.bgWorld),
  surface: hexToThreeColor(prcColors.bgWorldGround),
  ring: hexToThreeColor(prcColors.worldRing),
  lightAmbient: hexToThreeColor(prcColors.worldLightAmbient),
  lightKey: hexToThreeColor(prcColors.worldLightKey),
} as const;
