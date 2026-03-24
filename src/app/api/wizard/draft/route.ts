import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";

export const PUT = withAuth(async (request, { user, supabase }) => {
  const { projectId, topic, wizard_step, draft_scenes, template, video_description, video_tags, aspect_ratio, video_quality } =
    await request.json();

  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (topic !== undefined) updates.topic = topic;
  if (wizard_step !== undefined) updates.wizard_step = wizard_step;
  if (draft_scenes !== undefined) updates.draft_scenes = draft_scenes;
  if (template !== undefined) updates.selected_template = template;
  if (video_description !== undefined) updates.video_description = video_description;
  if (video_tags !== undefined) updates.video_tags = video_tags;
  if (aspect_ratio !== undefined) updates.aspect_ratio = aspect_ratio;
  if (video_quality !== undefined) updates.video_quality = video_quality;

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from("projects")
      .update(updates)
      .eq("id", projectId)
      .eq("user_id", user.id);

    if (error) {
      console.error("[draft] Supabase update error:", JSON.stringify(error), "updates:", JSON.stringify(updates));
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
});
