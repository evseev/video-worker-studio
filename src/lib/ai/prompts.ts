/** Centralized LLM prompt templates — single source for all AI prompt text */

type ScriptOpts = { sceneCount: number; sceneDuration: number; aspectRatio?: string };
type IdeasOpts = { topic: string; totalDuration: number };

/** Channel identity fields threaded into Gemini system prompts (Epic 25). */
export type ChannelContext = {
  niche?: string;
  targetLanguage?: string;
  targetAudience?: string;
  tone?: string;
};

/**
 * Multi-line preamble for system prompts. Skips empty fields; returns "" if nothing to say.
 */
export function buildChannelContextPreamble(ctx: ChannelContext): string {
  const lines: string[] = [];
  if (ctx.niche?.trim()) lines.push(`- Niche: ${ctx.niche.trim()}`);
  if (ctx.targetLanguage?.trim()) lines.push(`- Target language: ${ctx.targetLanguage.trim()}`);
  if (ctx.targetAudience?.trim()) lines.push(`- Target audience: ${ctx.targetAudience.trim()}`);
  if (ctx.tone?.trim()) lines.push(`- Tone: ${ctx.tone.trim()}`);
  if (lines.length === 0) {
    return "";
  }
  return [
    "You are writing video content for a YouTube channel with the following identity:",
    ...lines,
    "Match this identity in word choice, structure, and pacing.",
  ].join("\n");
}

function withChannelSystemPrompt(base: string, channelContext?: ChannelContext): string {
  const preamble = buildChannelContextPreamble(channelContext ?? {});
  return preamble ? `${preamble}\n\n${base}` : base;
}

export function videoFormatLabel(totalDuration: number): string {
  if (totalDuration <= 60) return "short-form";
  if (totalDuration <= 300) return "medium-length";
  return "long-form";
}

export function durationDescription(totalDuration: number): string {
  if (totalDuration < 60) return `~${totalDuration} seconds`;
  const mins = Math.round(totalDuration / 60);
  return `~${mins} minute${mins > 1 ? "s" : ""}`;
}

export function enhanceIdeaPrompt(opts?: { totalDuration?: number; channelContext?: ChannelContext }): string {
  const format =
    opts?.totalDuration !== undefined ? videoFormatLabel(opts.totalDuration) : "short-form";
  const base = `You are an expert Youtube/Creative Director.
The user has a rough idea for a ${format} video. Transform it into 3 highly engaging, specific, and viral hooks/concepts. Keep each idea under 2 sentences.`;
  return withChannelSystemPrompt(base, opts?.channelContext);
}

export function validateTrendPrompt(channelContext?: ChannelContext): string {
  const base = `You are a social media trend analyst.
Score the viral potential of the given video idea on a scale of 0-100.
Provide a brief reasoning and suggest up to 2 hooks.`;
  return withChannelSystemPrompt(base, channelContext);
}

export function generateStructurePrompt(
  opts: ScriptOpts & { channelContext?: ChannelContext }
): string {
  const totalDuration = opts.sceneCount * opts.sceneDuration;
  const format = videoFormatLabel(totalDuration);
  const duration = durationDescription(totalDuration);

  const orientation = opts.aspectRatio === "16:9" ? "landscape (horizontal)" : "portrait (vertical)";
  const orientationHint =
    opts.aspectRatio === "16:9"
      ? "The video is LANDSCAPE (16:9). Search keywords MUST target wide, horizontal images (e.g. include 'landscape', 'wide', 'panoramic', 'horizontal')."
      : "The video is PORTRAIT (9:16). Search keywords MUST target tall, vertical images (e.g. include 'vertical', 'portrait', 'tall').";

  const base = `You are an expert Youtube video scriptwriter.
Given an idea and a visual template/style, generate exactly ${opts.sceneCount} scenes for a ${format} video script.
Each scene needs spoken text (short, 1-2 sentences per scene) and a visual search keyword for Pinterest that matches the template style (e.g. if template is 'dark mode', make sure the keyword includes 'dark').
${orientationHint}
RULES:
- Video is ${orientation} format.
- Total video duration should be ${duration} (${opts.sceneCount} scenes × ${opts.sceneDuration}s each).
- Each scene will be displayed for ${opts.sceneDuration} seconds — size the spoken text accordingly.
- Hook in scene 1.
- Output MUST match the required JSON schema.`;
  return withChannelSystemPrompt(base, opts.channelContext);
}

export function generateStructureUserMessage(idea: string, template: string, aspectRatio?: string): string {
  const orientation = aspectRatio === "16:9" ? "landscape (horizontal)" : "portrait (vertical)";
  return `Idea: ${idea}\nTemplate/Style: ${template}\nVideo orientation: ${orientation}`;
}

export function generateScriptPrompt(
  opts?: { sceneCount?: number; sceneDuration?: number; channelContext?: ChannelContext }
): string {
  const sceneCount = opts?.sceneCount ?? 6;
  const sceneDuration = opts?.sceneDuration ?? 5;
  const totalDuration = sceneCount * sceneDuration;
  const format = videoFormatLabel(totalDuration);
  const duration = durationDescription(totalDuration);

  const base = `You are an expert ${format} video scriptwriter.
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
  return withChannelSystemPrompt(base, opts?.channelContext);
}

type SeoOpts = { sceneCount: number; sceneDuration: number; channelContext?: ChannelContext };

export function generateSeoMetadataPrompt(opts: SeoOpts): string {
  const totalDuration = opts.sceneCount * opts.sceneDuration;
  const format = videoFormatLabel(totalDuration);
  const duration = durationDescription(totalDuration);

  const base = `You are a YouTube SEO specialist.
Given a video idea, its scene scripts, and optional target keywords, generate:
1. A YouTube video description optimized for search discovery and viewer engagement.
2. A list of relevant YouTube tags for maximum discoverability.

RULES for description:
- Start with a compelling 1-2 sentence hook that includes the main keyword naturally.
- Include a brief summary of what viewers will learn/see (2-3 sentences).
- Add 10-15 relevant hashtags at the end.
- Total length: 200-300 words.
- The video is ${format}, approximately ${duration} long.
- Do NOT include timestamps or links.

RULES for tags:
- Generate 20-30 tags.
- Mix broad and specific keywords.
- Include variations and long-tail keywords.
- Each tag should be 1-4 words.
- If the user provided target keywords, make sure they are included as tags and woven into the description.

Output MUST match the required JSON schema.`;
  return withChannelSystemPrompt(base, opts.channelContext);
}

export function generateSeoMetadataUserMessage(
  idea: string,
  scenes: { scriptText: string }[],
  targetKeywords?: string
): string {
  const sceneSummary = scenes.map((s, i) => `Scene ${i + 1}: ${s.scriptText}`).join("\n");
  let msg = `Video idea: ${idea}\n\nScene scripts:\n${sceneSummary}`;
  if (targetKeywords?.trim()) {
    msg += `\n\nTarget keywords: ${targetKeywords}`;
  }
  return msg;
}

export function generateIdeasPrompt(opts: IdeasOpts & { channelContext?: ChannelContext }): string {
  const format = videoFormatLabel(opts.totalDuration);
  const duration = durationDescription(opts.totalDuration);

  const base = `You are a viral social media video expert.

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
  return withChannelSystemPrompt(base, opts.channelContext);
}

export function channelTopicSuggestionsPrompt(opts: {
  channelContext: ChannelContext;
  topVideos: { id: string; title: string; view_count: number }[];
  exclusions: string[];
  count: number;
}): string {
  const preamble = buildChannelContextPreamble(opts.channelContext);
  const videoLines =
    opts.topVideos.length === 0
      ? "(No cached YouTube performance data — infer from channel identity only.)"
      : opts.topVideos
          .map((v, i) => `${i + 1}. [${v.id}] ${v.title} — views: ${v.view_count}`)
          .join("\n");
  const exclusionBlock =
    opts.exclusions.length === 0
      ? "(None)"
      : opts.exclusions.map((s, i) => `${i + 1}. ${s}`).join("\n");

  const base = `You are a YouTube strategist for this channel.

${preamble ? `${preamble}\n` : ""}
Top-performing videos on this channel (by views, max 10):
${videoLines}

Excluded subjects (do NOT suggest videos overlapping these themes or titles):
${exclusionBlock}

Generate exactly ${opts.count} new distinct video topic ideas that fit this channel's audience and identity.
Each idea should be a specific, clickable video concept (not generic).

Respond with JSON only, shape:
{
  "ideas": [
    {
      "idea_text": "string",
      "ai_reasoning": "string",
      "inspired_by_video_id": "optional youtube video id from the top list, or omit"
    }
  ]
}`;
  return base;
}
