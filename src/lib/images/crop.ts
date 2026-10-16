/**
 * Face-aware cropping expressed as CSS object-position for `object-fit: cover`
 * (the field the wizard's drag-to-pan already writes, see src/components/DraggableImage.tsx).
 *
 * With cover, the image is scaled by s = max(tw/W, th/H); the overflow on each axis is
 * o = W*s - tw (or H*s - th). object-position X% shifts the image left by X% of the overflow.
 * We solve for the X/Y that puts the face centre at the target point of the frame.
 */
export interface CropInput {
  imageWidth: number;
  imageHeight: number;
  /** [x, y, w, h] in image pixels. */
  faceBox: [number, number, number, number];
  /** Slot size in output pixels (any unit — only the ratio matters). */
  targetWidth: number;
  targetHeight: number;
  /** Where the face centre should land, as fractions of the frame. Default: centred, upper third. */
  anchorX?: number;
  anchorY?: number;
}

function clampPct(v: number): number {
  return Math.round(Math.max(0, Math.min(100, v)) * 10) / 10;
}

export function faceObjectPosition(input: CropInput): string {
  const { imageWidth: W, imageHeight: H, targetWidth: tw, targetHeight: th } = input;
  const [fx, fy, fw, fh] = input.faceBox;
  const ax = input.anchorX ?? 0.5;
  const ay = input.anchorY ?? 0.38;
  if (W <= 0 || H <= 0 || tw <= 0 || th <= 0) return "50% 50%";
  const s = Math.max(tw / W, th / H);
  const ox = W * s - tw;
  const oy = H * s - th;
  const cx = (fx + fw / 2) * s;
  // Use a point slightly above the box centre (eyes) so foreheads are not cut.
  const cy = (fy + fh * 0.45) * s;
  const x = ox > 0.5 ? ((cx - ax * tw) / ox) * 100 : 50;
  const y = oy > 0.5 ? ((cy - ay * th) / oy) * 100 : 50;
  return `${clampPct(x)}% ${clampPct(y)}%`;
}

/** Output-pixel size of an image slot for the given template and video size. */
export function slotSize(
  template: string,
  slotIndex: number,
  video: { width: number; height: number }
): { width: number; height: number } {
  const { width, height } = video;
  const landscape = width >= height;
  if (template === "comparison") {
    // Two equal halves with a 4px gap (ComparisonScene.tsx): side by side in 16:9, stacked in 9:16.
    return landscape ? { width: (width - 4) / 2, height } : { width, height: (height - 4) / 2 };
  }
  if (template === "fact-card") {
    // FactCardScene.tsx: hero image is full width × 35% height; secondary is a 48px square avatar.
    return slotIndex === 0 ? { width, height: Math.round(height * 0.35) } : { width: 48, height: 48 };
  }
  return { width, height };
}
