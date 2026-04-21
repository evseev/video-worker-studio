import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { enhanceIdea } from "@/lib/ai/wizard";
import { z } from "zod";
import {
  SCENE_COUNT_MIN,
  SCENE_COUNT_MAX,
  SCENE_DURATION_MIN,
  SCENE_DURATION_MAX,
} from "@/lib/video-constraints";

const EnhanceIdeaRequestSchema = z.object({
  projectId: z.string().optional(),
  idea: z.string().min(1, "Idea is required"),
  sceneCount: z.number().int().min(SCENE_COUNT_MIN).max(SCENE_COUNT_MAX).optional(),
  sceneDuration: z.number().int().min(SCENE_DURATION_MIN).max(SCENE_DURATION_MAX).optional(),
});

export const POST = withAuth(async (request, { user, supabase }) => {
  const payload = await request.json();
  const parsedReq = EnhanceIdeaRequestSchema.safeParse(payload);
  if (!parsedReq.success) {
    return NextResponse.json({ error: parsedReq.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 });
  }
  const { projectId, idea, sceneCount, sceneDuration } = parsedReq.data;

  const totalDuration = (sceneCount ?? 6) * (sceneDuration ?? 5);
  const enhancedIdeas = await enhanceIdea(idea, totalDuration);

  if (projectId) {
    await supabase
      .from("projects")
      .update({ topic: idea, wizard_step: "idea" })
      .eq("id", projectId)
      .eq("user_id", user.id);
  }

  return NextResponse.json({ ideas: enhancedIdeas });
}, { rateLimit: "ai" });
