import { z } from "zod";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Google OAuth for the channel owner (youtube.upload + youtube.force-ssl for captions/thumbnails).
 * Tokens are stored via SECURITY DEFINER RPCs in public.youtube_connections (never readable by clients).
 *
 * Env: YOUTUBE_OAUTH_CLIENT_ID, YOUTUBE_OAUTH_CLIENT_SECRET, NEXT_PUBLIC_APP_URL (redirect base).
 * Redirect URI to register in Google Cloud: <app>/api/youtube/oauth/callback
 */
export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.force-ssl",
];

export function isYouTubeOAuthConfigured(): boolean {
  return Boolean(process.env.YOUTUBE_OAUTH_CLIENT_ID && process.env.YOUTUBE_OAUTH_CLIENT_SECRET);
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function redirectUri(): string {
  return `${appUrl()}/api/youtube/oauth/callback`;
}

/** Signed state = channelId.userId.expiry.hmac — binds the callback to the user who started it. */
function stateSecret(): string {
  const s = process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
  if (!s) throw new Error("YOUTUBE_OAUTH_CLIENT_SECRET is not set");
  return s;
}

export function signState(channelId: string, userId: string, ttlSec = 600): string {
  const payload = `${channelId}.${userId}.${Math.floor(Date.now() / 1000) + ttlSec}`;
  const mac = createHmac("sha256", stateSecret()).update(payload).digest("hex");
  return `${payload}.${mac}`;
}

export function verifyState(state: string): { channelId: string; userId: string } | null {
  const parts = state.split(".");
  if (parts.length !== 4) return null;
  const [channelId, userId, exp, mac] = parts;
  const expected = createHmac("sha256", stateSecret()).update(`${channelId}.${userId}.${exp}`).digest("hex");
  const a = Buffer.from(mac, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  return { channelId, userId };
}

export function authorizationUrl(channelId: string, userId: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.YOUTUBE_OAUTH_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("scope", YOUTUBE_SCOPES.join(" "));
  url.searchParams.set("state", signState(channelId, userId));
  return url.toString();
}

const TokenResponse = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
  token_type: z.string(),
});

export type Tokens = z.infer<typeof TokenResponse>;

async function tokenRequest(body: Record<string, string>, fetchImpl: typeof fetch = fetch): Promise<Tokens> {
  const res = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.YOUTUBE_OAUTH_CLIENT_ID ?? "",
      client_secret: process.env.YOUTUBE_OAUTH_CLIENT_SECRET ?? "",
      ...body,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Google token endpoint ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
  return TokenResponse.parse(json);
}

export function exchangeCode(code: string, fetchImpl?: typeof fetch): Promise<Tokens> {
  return tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() }, fetchImpl);
}

export function refreshAccessToken(refreshToken: string, fetchImpl?: typeof fetch): Promise<Tokens> {
  return tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" }, fetchImpl);
}
