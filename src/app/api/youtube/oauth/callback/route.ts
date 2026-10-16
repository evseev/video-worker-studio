import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCode, verifyState } from "@/lib/youtube/oauth";
import { autopilotDb } from "@/lib/autopilot/db";

/** Google redirects here after consent; stores tokens via a service-role RPC. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", url));

  const state = verifyState(url.searchParams.get("state") ?? "");
  if (!state || state.userId !== user.id) return NextResponse.json({ error: "Invalid or expired state" }, { status: 400 });
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.json({ error: url.searchParams.get("error") ?? "Missing code" }, { status: 400 });

  const tokens = await exchangeCode(code);
  if (!tokens.refresh_token) {
    return NextResponse.json({ error: "Google did not return a refresh token; remove the app's access in your Google account and retry" }, { status: 400 });
  }
  // Which YouTube channel did the user authorise?
  const me = await fetch("https://www.googleapis.com/youtube/v3/channels?part=id&mine=true", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const meJson = (await me.json().catch(() => ({}))) as { items?: Array<{ id: string }> };
  const youtubeChannelId = meJson.items?.[0]?.id ?? null;

  const { error } = await autopilotDb().rpc("worker_save_youtube_tokens", {
    p_channel_id: state.channelId,
    p_youtube_channel_id: youtubeChannelId,
    p_refresh_token: tokens.refresh_token,
    p_access_token: tokens.access_token,
    p_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    p_scopes: (tokens.scope ?? "").split(" ").filter(Boolean),
  });
  if (error) return NextResponse.json({ error: "Could not store the connection" }, { status: 500 });
  return NextResponse.redirect(new URL(`/channels/${state.channelId}/settings?youtube=connected`, url));
}
