import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChannelContext } from "@/lib/ai/prompts";

type ChannelAiFields = {
  niche: string | null;
  target_language: string | null;
  target_audience: string | null;
  tone: string | null;
};

type ProjectChannelJoin = {
  channel_id: string | null;
  channels: ChannelAiFields | ChannelAiFields[] | null;
};

/**
 * Loads AI channel context for a project (niche, language, audience, tone).
 * Returns `{}` when the project has no channel or the row is missing — callers never need null checks.
 */
export async function getChannelContextForProject(
  supabase: SupabaseClient,
  projectId: string
): Promise<ChannelContext> {
  try {
    const { data, error } = await supabase
      .from("projects")
      .select("channel_id, channels(niche, target_language, target_audience, tone)")
      .eq("id", projectId)
      .maybeSingle();

    if (error || !data) {
      return {};
    }

    const row = data as unknown as ProjectChannelJoin;
    if (!row.channel_id || !row.channels) {
      return {};
    }

    const ch = Array.isArray(row.channels) ? row.channels[0] : row.channels;
    if (!ch) {
      return {};
    }

    const ctx: ChannelContext = {};
    if (ch.niche?.trim()) ctx.niche = ch.niche.trim();
    if (ch.target_language?.trim()) ctx.targetLanguage = ch.target_language.trim();
    if (ch.target_audience?.trim()) ctx.targetAudience = ch.target_audience.trim();
    if (ch.tone?.trim()) ctx.tone = ch.tone.trim();
    return ctx;
  } catch {
    return {};
  }
}
