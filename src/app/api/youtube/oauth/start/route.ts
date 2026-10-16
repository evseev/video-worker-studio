import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authorizationUrl, isYouTubeOAuthConfigured } from "@/lib/youtube/oauth";

/** Starts Google consent for uploading to the channel owner's YouTube account. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isYouTubeOAuthConfigured()) {
    return NextResponse.json({ error: "YOUTUBE_OAUTH_CLIENT_ID / YOUTUBE_OAUTH_CLIENT_SECRET are not set" }, { status: 503 });
  }
  const channelId = new URL(request.url).searchParams.get("channelId") ?? "";
  const { data: channel } = await supabase.from("channels").select("id").eq("id", channelId).eq("user_id", user.id).maybeSingle();
  if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  return NextResponse.redirect(authorizationUrl(channelId, user.id));
}
