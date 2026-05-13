import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { generateStructure } from "@/lib/ai/wizard";
import { TEMPLATE_IDS } from "@/templates";
import type { TemplateId } from "@/templates/types";
import { z } from "zod";
import {
  SCENE_COUNT_MIN,
  SCENE_COUNT_MAX,
  SCENE_DURATION_MIN,
  SCENE_DURATION_MAX,
} from "@/lib/video-constraints";

const GenerateStructureRequestSchema = z.object({
  projectId: z.string().optional(),
  idea: z.string().min(1, "Idea is required"),
  template: z.string().min(1, "Template is required"),
  aspectRatio: z.enum(["9:16", "16:9"]).optional(),
  sceneCount: z.number().int().min(SCENE_COUNT_MIN).max(SCENE_COUNT_MAX).optional(),
  sceneDuration: z.number().int().min(SCENE_DURATION_MIN).max(SCENE_DURATION_MAX).optional(),
});

export const POST = withAuth(async (request, { user, supabase }) => {
  const payload = await request.json();
  const parsedReq = GenerateStructureRequestSchema.safeParse(payload);
  if (!parsedReq.success) {
    return NextResponse.json({ error: parsedReq.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 });
  }
  const { projectId, idea, template, aspectRatio, sceneCount, sceneDuration } = parsedReq.data;

  if (!TEMPLATE_IDS.includes(template as TemplateId)) {
    return NextResponse.json(
      { error: `Invalid template. Must be one of: ${TEMPLATE_IDS.join(", ")}` },
      { status: 400 }
    );
  }

  const templateId = template as TemplateId;

  let channelId: string | undefined;
  if (parsedReq.data.projectId) {
    const { data: proj } = await supabase
      .from("projects")
      .select("channel_id")
      .eq("id", parsedReq.data.projectId)
      .eq("user_id", user.id)
      .maybeSingle();
    channelId = proj?.channel_id ?? undefined;
  }

  const scenes = await generateStructure(idea, templateId, {
    aspectRatio,
    sceneCount,
    sceneDuration,
    supabase,
    channelId,
  });

  if (projectId) {
    await supabase
      .from("projects")
      .update({
        selected_template: templateId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        draft_scenes: scenes as any,
        wizard_step: "structure",
      })
      .eq("id", projectId)
      .eq("user_id", user.id);
  }

  return NextResponse.json({ scenes });
}, { rateLimit: "ai" });
