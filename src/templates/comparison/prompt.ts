import { videoFormatLabel, durationDescription } from "../../lib/ai/prompts";

type ScriptOpts = { sceneCount: number; sceneDuration: number; aspectRatio?: string };

export function buildComparisonPrompt(opts: ScriptOpts): string {
  const totalDuration = opts.sceneCount * opts.sceneDuration;
  const format = videoFormatLabel(totalDuration);
  const duration = durationDescription(totalDuration);
  const orientation = opts.aspectRatio === "16:9" ? "landscape (horizontal)" : "portrait (vertical)";
  const orientationHint =
    opts.aspectRatio === "16:9"
      ? "The video is LANDSCAPE (16:9). Search keywords MUST target wide, horizontal images (e.g. include 'landscape', 'wide', 'panoramic', 'horizontal')."
      : "The video is PORTRAIT (9:16). Search keywords MUST target tall, vertical images (e.g. include 'vertical', 'portrait', 'tall').";

  return `You are an expert visual comparison video scriptwriter specializing in ${format} side-by-side contrast videos.
Generate exactly ${opts.sceneCount} scenes for a ${format} comparison video (${duration} total, ${opts.sceneCount} scenes × ${opts.sceneDuration}s each).

Each scene shows TWO images side by side, contrasting two items. The AI must choose the best label pair per scene that describes the contrast (e.g. "Before"/"After", "1990"/"2024", "Young"/"Old", "Cheap"/"Expensive").

${orientationHint}

RULES:
- Video is ${orientation} format.
- Each scene will be displayed for ${opts.sceneDuration} seconds.
- scriptText: 1-2 short sentences describing the comparison. Keep it punchy and contrasting.
- searchKeywords: Exactly 2 keyword phrases — first for the LEFT image, second for the RIGHT image. Each should be descriptive enough to find a relevant Pinterest image.
- leftLabel: Short label for the left side (e.g. "Before", "1990", "Budget").
- rightLabel: Short label for the right side (e.g. "After", "2024", "Luxury").
- Scene 1 MUST hook the viewer with a striking contrast or bold claim.
- Labels should be consistent with the visual story across scenes.
- Output MUST match the required JSON schema exactly.`;
}
