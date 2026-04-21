import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { inngest } from "@/lib/inngest/client";
import { mergeRenderPayload, buildPersistedDraft } from "@/lib/merge-render-payload";
import type { Tables } from "@/lib/supabase/types";
import { z } from "zod";
import {
  SCENE_DURATION_MIN,
  SCENE_DURATION_MAX,
} from "@/lib/video-constraints";

const RenderRequestSchema = z.object({
  projectId: z.string().min(1, "Missing projectId"),
  sceneDuration: z.number().int().min(SCENE_DURATION_MIN).max(SCENE_DURATION_MAX).optional(),
}).passthrough();

export const POST = withAuth(async (request, { user, supabase }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsedReq = RenderRequestSchema.safeParse(body);
  if (!parsedReq.success) {
    return NextResponse.json({ error: parsedReq.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 });
  }
  body = parsedReq.data;
  const projectId = body.projectId as string;

  const { data: row, error: fetchError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !row) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const project = row as Tables<"projects">;

  if (project.status === "processing" || project.status === "rendering") {
    return NextResponse.json(
      { error: "Project is already being processed" },
      { status: 409 }
    );
  }

  const merged = mergeRenderPayload(body, project);

  const updates: Record<string, unknown> = {
    wizard_step: "render",
    selected_template: merged.template,
    status: "processing",
    draft_scenes: buildPersistedDraft(project, merged),
    aspect_ratio: merged.aspectRatio,
    video_quality: merged.videoQuality,
    background_music: merged.backgroundMusic,
    voiceover_url: merged.voiceoverUrl,
    scene_transition: merged.sceneTransition,
    image_motion: merged.imageMotion,
    text_animation: merged.textAnimation,
    caption_style: merged.captionStyle,
    comparison_overlay_mode: merged.comparisonOverlayMode,
  };

  const { error: updateError } = await supabase
    .from("projects")
    .update(updates)
    .eq("id", projectId)
    .eq("user_id", user.id);

  if (updateError) {
    const msg =
      [updateError.message, updateError.code, updateError.details]
        .filter(Boolean)
        .join(" — ") || "Database update failed";
    console.error("[wizard/render] projects update failed:", updateError);
    return NextResponse.json(
      { error: msg, code: updateError.code },
      { status: 500 }
    );
  }

  try {
    const eventData: Record<string, unknown> = {
      projectId: merged.projectId,
      topic: project.topic,
      template: merged.template,
      aspectRatio: merged.aspectRatio,
      videoQuality: merged.videoQuality,
      sceneDuration: merged.sceneDuration,
      backgroundMusic: merged.backgroundMusic,
      voiceoverUrl: merged.voiceoverUrl,
      sceneTransition: merged.sceneTransition,
      imageMotion: merged.imageMotion,
      textAnimation: merged.textAnimation,
      captionStyle: merged.captionStyle,
      comparisonOverlayMode: merged.comparisonOverlayMode,
      userId: user.id,
    };
    if (merged.scenes !== undefined) {
      eventData.scenes = merged.scenes;
    }

    await inngest.send({
      name: "video/generate",
      data: eventData,
    });
  } catch (inngestErr) {
    const { error: rollbackError } = await supabase
      .from("projects")
      .update({
        status: project.status,
        wizard_step: project.wizard_step,
      })
      .eq("id", projectId)
      .eq("user_id", user.id);
    if (rollbackError) {
      console.error("[wizard/render] rollback after queue failure failed:", rollbackError);
    }

    console.error("[wizard/render] inngest.send failed:", inngestErr);
    const msg =
      inngestErr instanceof Error ? inngestErr.message : String(inngestErr);
    return NextResponse.json(
      { error: msg || "Failed to queue render job" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}, { rateLimit: "render" });
