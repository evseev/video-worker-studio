/** Centralized LLM prompt templates — single source for all AI prompt text */

type VideoFormatOpts = { totalDuration: number };
type ScriptOpts = { sceneCount: number; sceneDuration: number; aspectRatio?: string };
type IdeasOpts = { topic: string; totalDuration: number };

function videoFormatLabel(totalDuration: number): string {
  if (totalDuration <= 60) return "short-form";
  if (totalDuration <= 300) return "medium-length";
  return "long-form";
}

function durationDescription(totalDuration: number): string {
  if (totalDuration < 60) return `~${totalDuration} seconds`;
  const mins = Math.round(totalDuration / 60);
  return `~${mins} minute${mins > 1 ? "s" : ""}`;
}

export function enhanceIdeaPrompt(opts?: VideoFormatOpts): string {
  const format = opts ? videoFormatLabel(opts.totalDuration) : "short-form";
  return `You are an expert Youtube/Creative Director.
The user has a rough idea for a ${format} video. Transform it into 3 highly engaging, specific, and viral hooks/concepts. Keep each idea under 2 sentences.`;
}

export function validateTrendPrompt(): string {
  return `You are a social media trend analyst.
Score the viral potential of the given video idea on a scale of 0-100.
Provide a brief reasoning and suggest up to 2 hooks.`;
}

export function generateStructurePrompt(opts: ScriptOpts): string {
  const totalDuration = opts.sceneCount * opts.sceneDuration;
  const format = videoFormatLabel(totalDuration);
  const duration = durationDescription(totalDuration);

  const orientation = opts.aspectRatio === "16:9" ? "landscape (horizontal)" : "portrait (vertical)";
  const orientationHint = opts.aspectRatio === "16:9"
    ? "The video is LANDSCAPE (16:9). Search keywords MUST target wide, horizontal images (e.g. include 'landscape', 'wide', 'panoramic', 'horizontal')."
    : "The video is PORTRAIT (9:16). Search keywords MUST target tall, vertical images (e.g. include 'vertical', 'portrait', 'tall').";

  return `You are an expert Youtube video scriptwriter.
Given an idea and a visual template/style, generate exactly ${opts.sceneCount} scenes for a ${format} video script.
Each scene needs spoken text (short, 1-2 sentences per scene) and a visual search keyword for Pinterest that matches the template style (e.g. if template is 'dark mode', make sure the keyword includes 'dark').
${orientationHint}
RULES:
- Video is ${orientation} format.
- Total video duration should be ${duration} (${opts.sceneCount} scenes × ${opts.sceneDuration}s each).
- Each scene will be displayed for ${opts.sceneDuration} seconds — size the spoken text accordingly.
- Hook in scene 1.
- Output MUST match the required JSON schema.`;
}

export function generateStructureUserMessage(idea: string, template: string, aspectRatio?: string): string {
  const orientation = aspectRatio === "16:9" ? "landscape (horizontal)" : "portrait (vertical)";
  return `Idea: ${idea}\nTemplate/Style: ${template}\nVideo orientation: ${orientation}`;
}

export function generateScriptPrompt(opts?: { sceneCount?: number; sceneDuration?: number }): string {
  const sceneCount = opts?.sceneCount ?? 6;
  const sceneDuration = opts?.sceneDuration ?? 5;
  const totalDuration = sceneCount * sceneDuration;
  const format = videoFormatLabel(totalDuration);
  const duration = durationDescription(totalDuration);

  return `You are an expert ${format} video scriptwriter.
Given a user TOPIC, generate a high-retention video script.
The script must be broken into exactly ${sceneCount} scenes.

For each scene, provide:
1. "scriptText": The actual words that will be spoken (used for captions/TTS). Keep each scene to 1-2 short sentences.
2. "searchKeyword": A single, highly descriptive keyword phrase (e.g., "moody cinematic coffee shop desk") that will be passed to a Pinterest image scraper to find the background asset. Make it visual and specific.

RULES:
- Total video duration should be ${duration} (${sceneCount} scenes × ${sceneDuration}s each).
- Each scene will be displayed for ${sceneDuration} seconds — size the spoken text accordingly.
- Hook the viewer in the first scene with a bold claim or question.
- End with a strong call to action or surprising twist.
- searchKeyword must be descriptive enough to find a beautiful, cinematic image.
- Output MUST match the required JSON schema exactly.`;
}

export function generateIdeasPrompt(opts: IdeasOpts): string {
  const format = videoFormatLabel(opts.totalDuration);
  const duration = durationDescription(opts.totalDuration);

  return `You are a viral social media video expert.

The user wants to make a ${format} video (${duration}) about: "${opts.topic}".
Please suggest 3 viral angles/hooks for this topic.

Format your response as a JSON object with this shape:
{
  "ideas": [
    {
      "title": "A short catchy title for the angle",
      "description": "A 1-2 sentence description of what the video is about.",
      "trendScore": 95
    }
  ]
}`;
}
