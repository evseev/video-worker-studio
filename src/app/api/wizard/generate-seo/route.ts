import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { generateSeoMetadata } from "@/lib/ai/wizard";

export const POST = withAuth(async (request, { user, supabase }) => {
  const { projectId, idea, scenes, targetKeywords, sceneCount, sceneDuration } =
    await request.json();

  if (!idea || !scenes?.length) {
    return NextResponse.json(
      { error: "Idea and scenes are required" },
      { status: 400 }
    );
  }

  const seoMetadata = await generateSeoMetadata(idea, scenes, {
    targetKeywords,
    sceneCount,
    sceneDuration,
  });

  if (projectId) {
    await supabase
      .from("projects")
      .update({
        video_description: seoMetadata.description,
        video_tags: seoMetadata.tags.join(", "),
      })
      .eq("id", projectId)
      .eq("user_id", user.id);
  }

  return NextResponse.json(seoMetadata);
}, { rateLimit: "ai" });
