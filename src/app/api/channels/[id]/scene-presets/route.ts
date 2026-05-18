import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api/with-auth";
import { getChannelById } from "@/lib/channels/repository";
import { ScenePresetSettingsJsonSchema } from "@/lib/channels/scene-preset-settings";
import type { Json, TablesInsert } from "@/lib/supabase/types";

const PostBodySchema = z
  .object({
    name: z.string().min(1).max(120),
    template_id: z.enum(["slideshow", "comparison", "fact-card"]),
    settings_json: z.unknown(),
  })
  .strict();

export async function GET(_request: Request, routeCtx: { params: Promise<{ id: string }> }) {
  const { id: channelId } = await routeCtx.params;
  const handler = withAuth(async (_req, { supabase }) => {
    const existing = await getChannelById(supabase, channelId);
    if (!existing.data) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("channel_scene_presets")
      .select("*")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ presets: data ?? [] });
  });
  return handler(_request);
}

export async function POST(request: Request, routeCtx: { params: Promise<{ id: string }> }) {
  const { id: channelId } = await routeCtx.params;
  const handler = withAuth(async (req, { supabase }) => {
    const existing = await getChannelById(supabase, channelId);
    if (!existing.data) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = PostBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
    }

    const settings = ScenePresetSettingsJsonSchema.safeParse(parsed.data.settings_json);
    if (!settings.success) {
      return NextResponse.json({ error: "Invalid settings_json" }, { status: 400 });
    }
    if (settings.data.selectedTemplate !== parsed.data.template_id) {
      return NextResponse.json({ error: "template_id must match selectedTemplate in settings_json" }, { status: 400 });
    }

    const insert: TablesInsert<"channel_scene_presets"> = {
      channel_id: channelId,
      name: parsed.data.name.trim(),
      template_id: parsed.data.template_id,
      settings_json: settings.data as unknown as Json,
    };

    const { data, error } = await supabase.from("channel_scene_presets").insert(insert).select("*").single();
    if (error) {
      if (/duplicate key|unique constraint|23505/i.test(error.message)) {
        return NextResponse.json({ error: "A preset with this name already exists" }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ preset: data });
  });
  return handler(request);
}
