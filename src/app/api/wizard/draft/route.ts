import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, topic, wizard_step, draft_scenes, template } = await request.json();

    if (!projectId) {
      return NextResponse.json(
        { error: "Missing projectId" },
        { status: 400 }
      );
    }

    const updates: Record<string, any> = {};
    if (topic !== undefined) updates.topic = topic;
    if (wizard_step !== undefined) updates.wizard_step = wizard_step;
    if (draft_scenes !== undefined) updates.draft_scenes = draft_scenes;
    if (template !== undefined) updates.template = template;

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
  } catch (error) {
    console.error("Failed to update draft:", error);
    return NextResponse.json(
      { error: "Failed to update draft" },
      { status: 500 }
    );
  }
}
