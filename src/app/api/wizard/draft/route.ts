import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";

export const PUT = withAuth(async (request, { user, supabase }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch (e) {
    console.error("[draft] Failed to parse request body:", e);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { projectId, topic, wizard_step, draft_scenes, template, video_description, video_tags } = body;

  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  // Only update columns that exist in the PostgREST schema cache.
  // Other fields (video_description, video_tags, aspect_ratio, video_quality)
  // are stored inside draft_scenes JSON and persisted to DB columns by the render route.
  const updates: Record<string, unknown> = {};
  if (topic !== undefined) updates.topic = topic;
  if (wizard_step !== undefined) updates.wizard_step = wizard_step;
  if (template !== undefined) updates.selected_template = template;

  // Merge video_description and video_tags into draft_scenes if present,
  // since their DB columns aren't reliably in the schema cache
  let mergedDraftScenes = draft_scenes as Record<string, unknown> | undefined;
  if (video_description !== undefined || video_tags !== undefined) {
    mergedDraftScenes = { ...(mergedDraftScenes ?? {}), videoDescription: video_description, videoTags: video_tags };
  }
  if (mergedDraftScenes !== undefined) updates.draft_scenes = mergedDraftScenes;

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from("projects")
      .update(updates)
      .eq("id", projectId)
      .eq("user_id", user.id);

    if (error) {
      console.error("[draft] Supabase update error:", JSON.stringify(error), "updates keys:", Object.keys(updates));
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
});
