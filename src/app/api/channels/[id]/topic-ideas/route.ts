import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api/with-auth";
import { getChannelById } from "@/lib/channels/repository";
import type { TablesInsert } from "@/lib/supabase/types";

const ManualBodySchema = z
  .object({
    idea_text: z.string().min(1).max(2000),
  })
  .strict();

const TopicIdeaStatusSchema = z.enum(["backlog", "shot", "skipped"]);

export async function GET(request: Request, routeCtx: { params: Promise<{ id: string }> }) {
  const { id: channelId } = await routeCtx.params;
  const handler = withAuth(async (req, { supabase }) => {
    const existing = await getChannelById(supabase, channelId);
    if (!existing.data) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const statusRaw = url.searchParams.get("status");
    let statusFilter: z.infer<typeof TopicIdeaStatusSchema> | null = null;
    if (statusRaw !== null && statusRaw !== "") {
      const parsed = TopicIdeaStatusSchema.safeParse(statusRaw);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid status query" }, { status: 400 });
      }
      statusFilter = parsed.data;
    }

    let query = supabase
      .from("channel_topic_ideas")
      .select("*")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }
    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ideas: data ?? [] });
  });
  return handler(request);
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
    const parsed = ManualBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
    }

    const row: TablesInsert<"channel_topic_ideas"> = {
      channel_id: channelId,
      idea_text: parsed.data.idea_text.trim(),
      source: "manual",
      status: "backlog",
    };
    const { data, error } = await supabase.from("channel_topic_ideas").insert(row).select("*").single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ idea: data });
  });
  return handler(request);
}
