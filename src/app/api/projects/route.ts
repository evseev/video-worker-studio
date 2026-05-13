import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api/with-auth";
import {
  applyDefaultsToDraftPayload,
  buildDefaultSettingsSnapshotFromInsert,
  getLastProjectSettings,
  snapshotSettingsToChannel,
} from "@/lib/channels/defaults";
import { getChannelById } from "@/lib/channels/repository";

const PostBodySchema = z.object({
  channelId: z.string().uuid("Invalid channelId"),
  copyLastSettings: z.boolean().optional().default(true),
  topic: z
    .string()
    .optional()
    .default("")
    .transform((t) => t.trim()),
});

export const POST = withAuth(async (request, { user, supabase }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = PostBodySchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid body";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { channelId, copyLastSettings, topic } = parsed.data;

  const { data: channel, error: chErr } = await getChannelById(supabase, channelId);
  if (chErr) {
    return NextResponse.json({ error: chErr.message }, { status: 500 });
  }
  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }
  if (channel.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let lastSettings = null;
  if (copyLastSettings) {
    lastSettings = await getLastProjectSettings(supabase, channelId);
  }

  const baseInsert = {
    topic,
    user_id: user.id,
    channel_id: channelId,
    status: "draft",
    wizard_step: "template",
  } as const;

  const insertPayload = applyDefaultsToDraftPayload(lastSettings, { ...baseInsert });

  const { data: project, error } = await supabase.from("projects").insert(insertPayload).select().single();

  if (error || !project) {
    return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
  }

  if (copyLastSettings && lastSettings) {
    const snapshot = buildDefaultSettingsSnapshotFromInsert(insertPayload, {
      voiceoverPreferred: lastSettings.hadVoiceover,
    });
    if (snapshot) {
      await snapshotSettingsToChannel(supabase, channelId, snapshot);
    }
  }

  return NextResponse.json({ project }, { status: 201 });
});
