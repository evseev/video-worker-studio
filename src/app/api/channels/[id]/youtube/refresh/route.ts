import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { refreshChannelYoutubeIfNeeded } from "@/lib/youtube/sync-channel-youtube";
import { z } from "zod";

const BodySchema = z
  .object({
    force: z.boolean().optional(),
  })
  .strict();

export async function POST(request: Request, routeCtx: { params: Promise<{ id: string }> }) {
  const { id: channelId } = await routeCtx.params;
  const handler = withAuth(async (req, { supabase }) => {
    let force = false;
    try {
      const raw = await req.json().catch(() => ({}));
      const parsed = BodySchema.safeParse(raw);
      if (parsed.success) force = parsed.data.force === true;
    } catch {
      /* empty body */
    }

    const signal = AbortSignal.timeout(force ? 12_000 : 12_000);
    const result = await refreshChannelYoutubeIfNeeded(supabase, channelId, {
      force,
      apiKey: process.env.YOUTUBE_API_KEY,
      signal,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      channel: result.channel,
      refreshed: result.refreshed,
    });
  });
  return handler(request);
}
