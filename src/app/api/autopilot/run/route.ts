import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api/with-auth";
import { inngest } from "@/lib/inngest/client";

const Body = z.object({ channelId: z.string().uuid() });

/**
 * "Run autopilot now" — sends the same event the weekday cron sends, scoped to one channel,
 * so Phase 1 works on a laptop that sleeps through 06:00.
 */
export const POST = withAuth(
  async (request, { user, supabase }) => {
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "channelId required" }, { status: 400 });
    const { data: channel } = await supabase
      .from("channels")
      .select("id")
      .eq("id", parsed.data.channelId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    await inngest.send({ name: "autopilot/run", data: { channelId: parsed.data.channelId } });
    return NextResponse.json({ ok: true });
  },
  { rateLimit: "render" }
);
