import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "@/lib/supabase/types";
import { getChannelById } from "@/lib/channels/repository";
import { channelTopicSuggestionsPrompt, type ChannelContext } from "@/lib/ai/prompts";
import { createGeminiClient, generateTextOrThrow, getTextModel } from "@/lib/ai/gemini";
import { listRecentSubjectKeysForChannel } from "@/lib/ai/subject-memory";
import { parseStoredYoutubeMeta, YoutubeTopVideoSchema } from "@/lib/youtube/types";

const CONTEXT_MAX = 200;

export function truncateChannelField(value: string | null | undefined): string {
  const t = (value ?? "").trim();
  return t.length <= CONTEXT_MAX ? t : t.slice(0, CONTEXT_MAX);
}

const SuggestTopicItemSchema = z.object({
  idea_text: z.string().min(1),
  ai_reasoning: z.string().optional(),
  inspired_by_video_id: z.string().optional(),
});

const SuggestTopicsGeminiSchema = z.object({
  ideas: z.array(SuggestTopicItemSchema).min(1).max(25),
});

export type SuggestedTopicIdea = z.infer<typeof SuggestTopicItemSchema>;

export async function runChannelTopicSuggestions(
  supabase: SupabaseClient<Database>,
  channelId: string,
  opts: { count: number; persist: boolean }
): Promise<{ ideas: SuggestedTopicIdea[] }> {
  const { data: ch, error } = await getChannelById(supabase, channelId);
  if (error || !ch) {
    throw new Error("Channel not found");
  }

  const channelContext: ChannelContext = {};
  const n = truncateChannelField(ch.niche);
  const lang = truncateChannelField(ch.target_language);
  const aud = truncateChannelField(ch.target_audience);
  const tone = truncateChannelField(ch.tone);
  if (n) channelContext.niche = n;
  if (lang) channelContext.targetLanguage = lang;
  if (aud) channelContext.targetAudience = aud;
  if (tone) channelContext.tone = tone;

  const meta = parseStoredYoutubeMeta(ch.youtube_meta);
  const rawVideos = meta?.top_videos ?? [];
  const topVideos: z.infer<typeof YoutubeTopVideoSchema>[] = [];
  for (const v of rawVideos.slice(0, 10)) {
    const r = YoutubeTopVideoSchema.safeParse(v);
    if (r.success) topVideos.push(r.data);
  }

  const exclusions = await listRecentSubjectKeysForChannel(supabase, channelId, 50);

  const count = Math.min(Math.max(opts.count, 1), 20);
  const prompt = channelTopicSuggestionsPrompt({
    channelContext,
    topVideos,
    exclusions,
    count,
  });

  const genAI = createGeminiClient(process.env.GEMINI_API_KEY);
  const model = getTextModel({
    genAI,
    generationConfig: { responseMimeType: "application/json" },
  });
  const jsonStr = await generateTextOrThrow(model, prompt);
  const parsed = SuggestTopicsGeminiSchema.parse(JSON.parse(jsonStr));
  const ideas = parsed.ideas.slice(0, count);

  if (opts.persist && ideas.length > 0) {
    const rows: TablesInsert<"channel_topic_ideas">[] = ideas.map((it) => ({
      channel_id: channelId,
      idea_text: it.idea_text.trim(),
      source: "ai" as const,
      status: "backlog" as const,
      ai_reasoning: it.ai_reasoning?.trim() || null,
      youtube_seed_video_id: it.inspired_by_video_id?.trim() || null,
    }));
    const { error: insErr } = await supabase.from("channel_topic_ideas").insert(rows);
    if (insErr) {
      console.warn("[suggest-topics] persist failed:", insErr.message);
    }
  }

  return { ideas };
}
