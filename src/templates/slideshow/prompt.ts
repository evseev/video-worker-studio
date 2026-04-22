import { videoFormatLabel, durationDescription } from "../../lib/ai/prompts";

type ScriptOpts = {
  sceneCount: number;
  sceneDuration: number;
  aspectRatio?: string;
  excludeSubjects?: string[];
};

export function buildSlideshowPrompt(opts: ScriptOpts): string {
  const totalDuration = opts.sceneCount * opts.sceneDuration;
  const format = videoFormatLabel(totalDuration);
  const duration = durationDescription(totalDuration);
  const orientation = opts.aspectRatio === "16:9" ? "landscape (horizontal)" : "portrait (vertical)";
  const orientationHint =
    opts.aspectRatio === "16:9"
      ? "The video is LANDSCAPE (16:9). Search keywords MUST target wide, horizontal images (e.g. include 'landscape', 'wide', 'panoramic', 'horizontal')."
      : "The video is PORTRAIT (9:16). Search keywords MUST target tall, vertical images (e.g. include 'vertical', 'portrait', 'tall').";
  const dedupeHint =
    opts.excludeSubjects && opts.excludeSubjects.length > 0
      ? `DO NOT REUSE SUBJECTS.
Every scene MUST feature a distinct subject. Never repeat a subject across scenes.
Already-used subjects (forbidden): ${opts.excludeSubjects.join(", ")}`
      : `DO NOT REUSE SUBJECTS.
Every scene MUST feature a distinct subject. Never repeat a subject across scenes.`;

  return `You are an expert storytelling video scriptwriter specializing in ${format} slideshow videos.
Generate exactly ${opts.sceneCount} scenes for a ${format} slideshow video (${duration} total, ${opts.sceneCount} scenes × ${opts.sceneDuration}s each).

Each scene displays ONE image with a caption. Focus on one idea per scene, building a continuous narrative across scenes.

${orientationHint}

${dedupeHint}

RULES:
- Video is ${orientation} format.
- Each scene will be displayed for ${opts.sceneDuration} seconds.
- scriptText: 1-2 full sentences of SPOKEN NARRATION (used for voiceover), max 25 words.
- captionText: A short ON-SCREEN caption that will be shown over the image, 3-8 words. It should summarize the single idea of the scene at a glance — do NOT repeat the full narration verbatim. Example: if scriptText is "Sleeping less than 6 hours doubles your risk of heart disease", captionText might be "Sleep under 6 hours = heart risk doubles".
- searchKeyword: A single descriptive keyword phrase for Pinterest (e.g. "moody cinematic coffee shop"). Must match the visual story.
- Scene 1 MUST hook the viewer with a bold claim or question.
- Each scene should build on the previous — maintain narrative momentum.
- Output MUST match the required JSON schema exactly.`;
}
