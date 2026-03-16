import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest/client";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // In a real flow, you might pass the chosen template or draft_scenes here,
    // or rely on the DB to hold them. We will pass the projectId to Inngest.
    const { projectId, scenes, template } = await request.json();

    if (!projectId) {
      return NextResponse.json(
        { error: "Missing projectId" },
        { status: 400 }
      );
    }

    // Optionally save the final scenes to DB before rendering, if modified by user
    if (scenes) {
       await supabase
         .from("projects")
         .update({ 
           draft_scenes: scenes,
           wizard_step: "render",
           selected_template: template || null
         })
         .eq("id", projectId)
         .eq("user_id", user.id);
    } else if (template) {
       await supabase
         .from("projects")
         .update({ 
           selected_template: template
         })
         .eq("id", projectId)
         .eq("user_id", user.id);
    }

    // Send event to Inngest which triggers the VideoGenerationWorker
    // Note: The worker currently expects "topic", we might not have it in the request payload anymore,
    // but the worker will read from DB.
    await inngest.send({
      name: "video/generate",
      data: { projectId, scenes, template },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to trigger render:", error);
    return NextResponse.json(
      { error: "Failed to start render" },
      { status: 500 }
    );
  }
}
