/** Resolve pixel dimensions from aspect ratio and quality settings */
export function resolveVideoDimensions(
  aspectRatio: string = "9:16",
  quality: string = "fullhd"
): { width: number; height: number } {
  const isLandscape = aspectRatio === "16:9";
  const is720p = quality === "720p" || quality === "hd";
  const is4k = quality === "4k";

  if (isLandscape) {
    if (is4k) return { width: 3840, height: 2160 };
    return is720p ? { width: 1280, height: 720 } : { width: 1920, height: 1080 };
  }
  if (is4k) return { width: 2160, height: 3840 };
  return is720p ? { width: 720, height: 1280 } : { width: 1080, height: 1920 };
}
