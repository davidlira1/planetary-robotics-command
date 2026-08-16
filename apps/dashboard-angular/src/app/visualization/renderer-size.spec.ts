import { applyRendererSize, cappedRendererPixelRatio, expectedDrawingBufferSize } from './renderer-size';

describe('renderer-size', () => {
  it('caps device pixel ratio at 2', () => {
    expect(cappedRendererPixelRatio(1)).toBe(1);
    expect(cappedRendererPixelRatio(2)).toBe(2);
    expect(cappedRendererPixelRatio(3)).toBe(2);
  });

  it('keeps a 2x drawing buffer while CSS size stays at the host size', () => {
    const cssWidth = 1175.67;
    const cssHeight = 567.33;
    expect(expectedDrawingBufferSize(cssWidth, cssHeight, 2)).toEqual({
      width: 2351,
      height: 1134,
    });
  });

  it('lets Three.js own canvas CSS by calling setSize without updateStyle=false', () => {
    const renderer = {
      setPixelRatio: jest.fn(),
      setSize: jest.fn(),
    };
    applyRendererSize(renderer, 1175.67, 567.33, 2);
    expect(renderer.setPixelRatio).toHaveBeenCalledWith(2);
    expect(renderer.setSize).toHaveBeenCalledWith(1175.67, 567.33);
    expect(renderer.setSize).not.toHaveBeenCalledWith(1175.67, 567.33, false);
  });
});
