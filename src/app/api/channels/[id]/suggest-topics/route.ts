import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api/with-auth";
import { runChannelTopicSuggestions } from "@/lib/channels/suggest-topics";

const BodySchema = z
  .object({
    count: z.number().int().min(1).max(20).optional(),
    persist: z.boolean().optional(),
  })
  .strict();

export async function POST(request: Request, routeCtx: { params: Promise<{ id: string }> }) {
  const { id: channelId } = await routeCtx.params;
  const handler = withAuth(async (req, { supabase }) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
    }
    const count = parsed.data.count ?? 10;
    const persist = parsed.data.persist === true;

    try {
      const { ideas } = await runChannelTopicSuggestions(supabase, channelId, { count, persist });
      return NextResponse.json({ ideas });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "Channel not found") {
        return NextResponse.json({ error: msg }, { status: 403 });
      }
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }, { rateLimit: "ai" });
  return handler(request);
}
