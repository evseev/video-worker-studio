import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { enhanceIdea } from "@/lib/ai/wizard";

export const POST = withAuth(async (request, { user, supabase }) => {
  const { projectId, idea } = await request.json();

  if (!idea) {
    return NextResponse.json({ error: "Idea is required" }, { status: 400 });
  }

  const enhancedIdeas = await enhanceIdea(idea);

  if (projectId) {
    await supabase
      .from("projects")
      .update({ topic: idea, wizard_step: "idea" })
      .eq("id", projectId)
      .eq("user_id", user.id);
  }

  return NextResponse.json({ ideas: enhancedIdeas });
}, { rateLimit: "ai" });
