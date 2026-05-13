import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { getChannelById } from "@/lib/channels/repository";

export async function DELETE(request: Request, routeCtx: { params: Promise<{ id: string; presetId: string }> }) {
  const { id: channelId, presetId } = await routeCtx.params;
  const handler = withAuth(async (_req, { supabase }) => {
    const existing = await getChannelById(supabase, channelId);
    if (!existing.data) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: preset, error: findErr } = await supabase
      .from("channel_scene_presets")
      .select("id")
      .eq("id", presetId)
      .eq("channel_id", channelId)
      .maybeSingle();

    if (findErr) {
      return NextResponse.json({ error: findErr.message }, { status: 500 });
    }
    if (!preset) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { error: delErr } = await supabase.from("channel_scene_presets").delete().eq("id", presetId);
    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  });
  return handler(request);
}
