import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { generateStructure } from "@/lib/ai/wizard";
import { TEMPLATE_IDS } from "@/templates";
import type { TemplateId } from "@/templates/types";

export const POST = withAuth(async (request, { user, supabase }) => {
  const { projectId, idea, template, aspectRatio, sceneCount, sceneDuration } = await request.json();

  if (!idea || !template) {
    return NextResponse.json(
      { error: "Idea and template are required" },
      { status: 400 }
    );
  }

  if (!TEMPLATE_IDS.includes(template as TemplateId)) {
    return NextResponse.json(
      { error: `Invalid template. Must be one of: ${TEMPLATE_IDS.join(", ")}` },
      { status: 400 }
    );
  }

  const templateId = template as TemplateId;
  const scenes = await generateStructure(idea, templateId, { aspectRatio, sceneCount, sceneDuration });

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
