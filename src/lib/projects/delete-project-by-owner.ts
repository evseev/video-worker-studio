import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteProjectAssets } from "@/lib/projects/delete-project-assets";

/**
 * Deletes a project row (RLS applies) and runs the shared asset cleanup pipeline.
 */
export async function deleteProjectByOwner(
  supabase: SupabaseClient,
  userId: string,
  projectId: string
): Promise<{ ok: true; warnings: string[] } | { ok: false; error: string }> {
  const { data: project, error: fetchError } = await supabase
    .from("projects")
    .select("id, video_url, channel_id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) {
    return { ok: false, error: fetchError.message };
  }
  if (!project) {
    return { ok: false, error: "not_found" };
  }

  const channelId = project.channel_id;
  const videoUrl = project.video_url;

  const { data: deletedRows, error: deleteError } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("user_id", userId)
    .select("id");

  if (deleteError) {
    return { ok: false, error: deleteError.message };
  }
  if (!deletedRows?.length) {
    return { ok: false, error: "not_found" };
  }

  const { warnings } = await deleteProjectAssets(projectId, videoUrl, channelId);
  return { ok: true, warnings };
}
