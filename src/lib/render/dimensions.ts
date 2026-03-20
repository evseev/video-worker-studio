/** Resolve pixel dimensions from aspect ratio and quality settings */
export function resolveVideoDimensions(
  aspectRatio: string = "9:16",
  quality: string = "1080p"
): { width: number; height: number } {
  const isLandscape = aspectRatio === "16:9";
  const is720p = quality === "720p";

  if (isLandscape) {
    return is720p ? { width: 1280, height: 720 } : { width: 1920, height: 1080 };
  }
  return is720p ? { width: 720, height: 1280 } : { width: 1080, height: 1920 };
}
