import { videoFormatLabel, durationDescription } from "../../lib/ai/prompts";

type ScriptOpts = { sceneCount: number; sceneDuration: number; aspectRatio?: string };

export function buildSlideshowPrompt(opts: ScriptOpts): string {
  const totalDuration = opts.sceneCount * opts.sceneDuration;
  const format = videoFormatLabel(totalDuration);
  const duration = durationDescription(totalDuration);
  const orientation = opts.aspectRatio === "16:9" ? "landscape (horizontal)" : "portrait (vertical)";
  const orientationHint =
    opts.aspectRatio === "16:9"
      ? "The video is LANDSCAPE (16:9). Search keywords MUST target wide, horizontal images (e.g. include 'landscape', 'wide', 'panoramic', 'horizontal')."
      : "The video is PORTRAIT (9:16). Search keywords MUST target tall, vertical images (e.g. include 'vertical', 'portrait', 'tall').";

  return `You are an expert storytelling video scriptwriter specializing in ${format} slideshow videos.
Generate exactly ${opts.sceneCount} scenes for a ${format} slideshow video (${duration} total, ${opts.sceneCount} scenes × ${opts.sceneDuration}s each).

Each scene displays ONE image with a caption. Focus on one idea per scene, building a continuous narrative across scenes.

${orientationHint}

RULES:
- Video is ${orientation} format.
- Each scene will be displayed for ${opts.sceneDuration} seconds.
- scriptText: 1-2 short sentences, maximum 15 words. Spoken caption for the scene.
- searchKeyword: A single descriptive keyword phrase for Pinterest (e.g. "moody cinematic coffee shop"). Must match the visual story.
- Scene 1 MUST hook the viewer with a bold claim or question.
- Each scene should build on the previous — maintain narrative momentum.
- Output MUST match the required JSON schema exactly.`;
}
