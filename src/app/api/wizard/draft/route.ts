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

  const updates: Record<string, unknown> = {};
  if (topic !== undefined) updates.topic = topic;
  if (wizard_step !== undefined) updates.wizard_step = wizard_step;
  if (draft_scenes !== undefined) updates.draft_scenes = draft_scenes;
  if (template !== undefined) updates.selected_template = template;
  if (video_description !== undefined) updates.video_description = video_description;
  if (video_tags !== undefined) updates.video_tags = video_tags;

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
