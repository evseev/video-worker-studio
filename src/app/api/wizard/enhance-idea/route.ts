import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enhanceIdea } from "@/lib/ai/wizard";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, idea } = await request.json();

    if (!idea) {
      return NextResponse.json(
        { error: "Idea is required" },
        { status: 400 }
      );
    }

    const enhancedIdeas = await enhanceIdea(idea);

    if (projectId) {
      // Update the project's wizard state if needed, but usually we just return the ideas to the frontend
      // so the user can pick one before proceeding.
      await supabase
        .from("projects")
        .update({ topic: idea, wizard_step: "idea" })
        .eq("id", projectId)
        .eq("user_id", user.id);
    }

    return NextResponse.json({ ideas: enhancedIdeas });
  } catch (error) {
    console.error("Failed to enhance idea:", error);
    return NextResponse.json(
      { error: "Failed to enhance idea" },
      { status: 500 }
    );
  }
}
