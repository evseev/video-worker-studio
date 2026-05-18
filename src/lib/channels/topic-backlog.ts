import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type TopicIdeaRow = Database["public"]["Tables"]["channel_topic_ideas"]["Row"];

export async function validateBacklogTopicIdeaForProject(
  supabase: SupabaseClient<Database>,
  topicIdeaId: string,
  channelId: string
): Promise<{ ok: true; idea: TopicIdeaRow } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("channel_topic_ideas")
    .select("*")
    .eq("id", topicIdeaId)
    .maybeSingle();

  if (error) {
    return { ok: false, message: error.message };
  }
  if (!data) {
    return { ok: false, message: "Topic idea not found" };
  }
  if (data.channel_id !== channelId) {
    return { ok: false, message: "Topic idea does not belong to this channel" };
  }
  if (data.status !== "backlog") {
    return { ok: false, message: "Topic idea is no longer available" };
  }

  return { ok: true, idea: data };
}

export async function markTopicIdeaShotForProject(
  supabase: SupabaseClient<Database>,
  topicIdeaId: string,
  projectId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from("channel_topic_ideas")
    .update({ status: "shot", used_in_project_id: projectId })
    .eq("id", topicIdeaId);

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true };
}
