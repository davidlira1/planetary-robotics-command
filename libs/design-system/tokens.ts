/**
 * Framework-neutral Deep Space color tokens.
 * Hex values must stay in sync with tokens.css.
 */
export const prcColors = {
  bgCanvas: '#050a0f',
  bgSurface: '#0b131d',
  bgSurfaceElevated: '#0e1823',
  bgDrawer: '#08111a',
  bgCard: '#0c1721',
  bgWorld: '#050b11',
  bgWorldGround: '#0c151a',
  bgMeterTrack: '#293a48',
  border: '#233746',
  borderDrawer: '#2d6170',
  borderSelection: '#287b91',
  textPrimary: '#e5edf2',
  textMuted: '#748896',
  accentPrimary: '#37dcff',
  statusNormal: '#4be0a3',
  statusWarning: '#ffd25c',
  statusCritical: '#ff5269',
  worldRing: '#21839a',
  worldLightAmbient: '#6f8a9a',
  worldLightKey: '#b7d7e4',
  worldMetalSteel: '#6d8494',
  worldMetalDark: '#24313b',
} as const;

export type PrcColorName = keyof typeof prcColors;
