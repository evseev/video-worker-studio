import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { inngest } from "@/lib/inngest/client";

export const POST = withAuth(async (request, { user, supabase }) => {
  const { projectId, scenes, template, aspectRatio, videoQuality, backgroundMusic, captionStyle, voiceoverUrl } = await request.json();

  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  // Check if project is already processing/rendering to prevent double-submit
  const { data: project } = await supabase
    .from("projects")
    .select("status")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (project?.status === "processing" || project?.status === "rendering") {
    return NextResponse.json(
      { error: "Project is already being processed" },
      { status: 409 }
    );
  }

  // Save final settings to DB before rendering
  const updates: Record<string, unknown> = { wizard_step: "render" };
  if (scenes) updates.draft_scenes = scenes;
  if (template) updates.selected_template = template;
  if (aspectRatio) updates.aspect_ratio = aspectRatio;
  if (videoQuality) updates.video_quality = videoQuality;
  if (backgroundMusic !== undefined) updates.background_music = backgroundMusic;
  if (captionStyle) updates.caption_style = captionStyle;
  if (voiceoverUrl !== undefined) updates.voiceover_url = voiceoverUrl;

  await supabase
    .from("projects")
    .update(updates)
    .eq("id", projectId)
    .eq("user_id", user.id);

  await inngest.send({
    name: "video/generate",
    data: { projectId, scenes, template, aspectRatio, videoQuality, backgroundMusic, captionStyle, voiceoverUrl, userId: user.id },
  });

  return NextResponse.json({ success: true });
}, { rateLimit: "render" });
