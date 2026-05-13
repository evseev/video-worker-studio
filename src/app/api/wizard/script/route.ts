import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { generateScript } from "@/lib/ai/generate-script";
import { getChannelContextForProject } from "@/lib/channels/context";
import { z } from "zod";

const ScriptRequestSchema = z.object({
  topic: z.string().min(1, "Missing topic"),
  projectId: z.string().uuid().optional(),
  sceneCount: z.number().int().positive().optional(),
  sceneDuration: z.number().int().positive().optional(),
});

export const POST = withAuth(async (req, { supabase }) => {
  const raw = await req.json();
  const parsed = ScriptRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }
  const { topic, projectId, sceneCount, sceneDuration } = parsed.data;

  const channelContext = projectId ? await getChannelContextForProject(supabase, projectId) : {};

  const scenes = await generateScript(topic, { sceneCount, sceneDuration, channelContext });
  return NextResponse.json({ scenes });
}, { rateLimit: "ai" });
