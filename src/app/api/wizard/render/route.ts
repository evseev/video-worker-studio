import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { inngest } from "@/lib/inngest/client";

export const POST = withAuth(async (request, { user, supabase }) => {
  const { projectId, scenes, template, aspectRatio, videoQuality, sceneDuration, backgroundMusic, voiceoverUrl } = await request.json();

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

  // Save final settings to DB before rendering.
  // Only update columns reliably in the PostgREST schema cache.
  // Settings like aspectRatio, videoQuality are stored in draft_scenes JSON
  // and passed directly to the Inngest event.
  const updates: Record<string, unknown> = {
    wizard_step: "render",
    selected_template: template,
    status: "processing",
  };
  if (scenes) {
    // Store full scenes + settings in draft_scenes for recovery
    updates.draft_scenes = { scenes, settings: { aspectRatio, quality: videoQuality } };
  }

  await supabase
    .from("projects")
    .update(updates)
    .eq("id", projectId)
    .eq("user_id", user.id);

  await inngest.send({
    name: "video/generate",
    data: { projectId, scenes, template, aspectRatio, videoQuality, sceneDuration, backgroundMusic, voiceoverUrl, userId: user.id },
  });

  return NextResponse.json({ success: true });
}, { rateLimit: "render" });
