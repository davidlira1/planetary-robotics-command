export const RENDERER_PIXEL_RATIO_CAP = 2;

export function cappedRendererPixelRatio(devicePixelRatio: number): number {
  return Math.min(Math.max(devicePixelRatio, 0), RENDERER_PIXEL_RATIO_CAP);
}

/** Matches Three.js WebGLRenderer drawing-buffer math for a CSS size + pixel ratio. */
export function expectedDrawingBufferSize(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
): { width: number; height: number } {
  const pixelRatio = cappedRendererPixelRatio(devicePixelRatio);
  return {
    width: Math.floor(cssWidth * pixelRatio),
    height: Math.floor(cssHeight * pixelRatio),
  };
}

export function applyRendererSize(
  renderer: {
    setPixelRatio(value: number): void;
    setSize(width: number, height: number, updateStyle?: boolean): void;
  },
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
): void {
  renderer.setPixelRatio(cappedRendererPixelRatio(devicePixelRatio));
  renderer.setSize(cssWidth, cssHeight);
}
