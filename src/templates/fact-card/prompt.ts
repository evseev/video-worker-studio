import { videoFormatLabel, durationDescription } from "../../lib/ai/prompts";

type ScriptOpts = { sceneCount: number; sceneDuration: number; aspectRatio?: string };

export function buildFactCardPrompt(opts: ScriptOpts): string {
  const totalDuration = opts.sceneCount * opts.sceneDuration;
  const format = videoFormatLabel(totalDuration);
  const duration = durationDescription(totalDuration);
  const orientation = opts.aspectRatio === "16:9" ? "landscape (horizontal)" : "portrait (vertical)";
  // Fact card template uses images in card layouts — the main image is a hero banner
  // and the secondary is a small thumbnail. Both work best as portrait/vertical images.
  const orientationHint = "Images are displayed in a CARD LAYOUT (hero image + thumbnail). Search keywords MUST target PORTRAIT/VERTICAL images (e.g. include 'portrait', 'vertical', 'headshot', 'close-up'). Do NOT use 'landscape' or 'wide'.";

  return `You are an expert identity and profile video scriptwriter specializing in ${format} fact-card videos.
Generate exactly ${opts.sceneCount} scenes for a ${format} fact-card video (${duration} total, ${opts.sceneCount} scenes × ${opts.sceneDuration}s each).

Each scene displays a profile/identity card for a person, place, concept, or subject. It shows a main image, a secondary image, a title, subtitle, and 2-3 quick facts.

${orientationHint}

RULES:
- Video is ${orientation} format.
- Each scene will be displayed for ${opts.sceneDuration} seconds.
- scriptText: 1-2 short sentences introducing or narrating the subject. Keep it informative and engaging.
- searchKeywords: Exactly 2 keyword phrases — first for the MAIN image, second for a SECONDARY image (e.g. related context or background). Both should be Pinterest-friendly.
- title: The name of the person, place, or subject (e.g. "Albert Einstein", "Tokyo", "Photosynthesis").
- subtitle: A short descriptor of their role, relationship, or category (e.g. "Theoretical Physicist", "Capital of Japan", "Plant Biology").
- facts: Exactly 2-3 quick fact items, each with a short label and a concise value.
  - Example: { label: "Born", value: "1879" }, { label: "Known for", value: "Theory of Relativity" }
- Scene 1 MUST hook the viewer with the most compelling or surprising subject.
- Each scene should feature a distinct, interesting subject that fits the overall topic.
- Output MUST match the required JSON schema exactly.`;
}
