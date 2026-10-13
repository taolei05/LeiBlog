import { describe, expect, it } from "vite-plus/test";

import {
  constrainCropPosition,
  getContainedSize,
  getMinimumScale,
  getRotatedSize,
  getWheelScale,
} from "./local-image-editor-math";

describe("local image editor math", () => {
  it("contains the source image inside the editor stage", () => {
    expect(
      getContainedSize({
        source: { height: 900, width: 1600 },
        target: { height: 500, width: 800 },
      }),
    ).toEqual({ height: 450, width: 800 });
  });

  it("keeps dragged images inside the crop box", () => {
    expect(
      constrainCropPosition({
        cropSize: { height: 200, width: 200 },
        imageDisplaySize: { height: 300, width: 400 },
        position: { x: 500, y: -500 },
        rotation: 0,
        scale: 1,
      }),
    ).toEqual({ x: 100, y: -50 });
  });

  it("accounts for rotation when calculating scale and bounds", () => {
    const rotatedSize = getRotatedSize({ rotation: 90, size: { height: 50, width: 100 } });

    expect(rotatedSize.height).toBeCloseTo(100);
    expect(rotatedSize.width).toBeCloseTo(50);
    expect(
      getMinimumScale({
        cropSize: { height: 200, width: 300 },
        imageDisplaySize: { height: 300, width: 500 },
        rotation: 90,
      }),
    ).toBe(1);
  });

  it("clamps wheel zoom within the editor range", () => {
    expect(
      getWheelScale({
        currentScale: 1.2,
        deltaY: -100,
        maxScale: 4,
        minScale: 1,
        sensitivity: 0.003,
      }),
    ).toBe(1.5);
    expect(
      getWheelScale({
        currentScale: 1.2,
        deltaY: 1000,
        maxScale: 4,
        minScale: 1,
        sensitivity: 0.003,
      }),
    ).toBe(1);
  });
});
