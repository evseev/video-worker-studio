import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";

export const PUT = withAuth(async (request, { user, supabase }) => {
  const { projectId, topic, wizard_step, draft_scenes, template } =
    await request.json();

  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (topic !== undefined) updates.topic = topic;
  if (wizard_step !== undefined) updates.wizard_step = wizard_step;
  if (draft_scenes !== undefined) updates.draft_scenes = draft_scenes;
  if (template !== undefined) updates.selected_template = template;

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from("projects")
      .update(updates)
      .eq("id", projectId)
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }
  }

  return NextResponse.json({ success: true });
});
