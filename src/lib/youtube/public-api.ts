import type { YoutubeTopVideo } from "@/lib/youtube/types";

const YT = "https://www.googleapis.com/youtube/v3";

export type YoutubeFetchFn = typeof fetch;

function stripHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "");
}

async function ytGet(
  path: string,
  params: Record<string, string>,
  apiKey: string,
  fetchFn: YoutubeFetchFn,
  signal?: AbortSignal
): Promise<unknown> {
  const u = new URL(`${YT}/${path}`);
  u.searchParams.set("key", apiKey);
  for (const [k, v] of Object.entries(params)) {
    u.searchParams.set(k, v);
  }
  const res = await fetchFn(u.toString(), { signal });
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errObj = json as { error?: { message?: string } };
    const msg = errObj?.error?.message ?? res.statusText;
    throw new Error(`YouTube API ${path} failed: ${msg}`);
  }
  return json;
}

/**
 * Resolves a public @handle to a YouTube channel id via Data API v3 `channels.list` + `forHandle`.
 */
export async function resolveYoutubeChannelId(
  apiKey: string,
  handle: string,
  fetchFn: YoutubeFetchFn = fetch,
  signal?: AbortSignal
): Promise<string | null> {
  const h = stripHandle(handle);
  if (!h) return null;
  const json = (await ytGet(
    "channels",
    { part: "id", forHandle: h },
    apiKey,
    fetchFn,
    signal
  )) as { items?: { id?: string }[] };
  const id = json.items?.[0]?.id;
  return id && id.length > 0 ? id : null;
}

export async function fetchYoutubeChannelSnippet(
  apiKey: string,
  channelId: string,
  fetchFn: YoutubeFetchFn = fetch,
  signal?: AbortSignal
): Promise<{ title: string }> {
  const json = (await ytGet(
    "channels",
    { part: "snippet", id: channelId },
    apiKey,
    fetchFn,
    signal
  )) as { items?: { snippet?: { title?: string } }[] };
  const title = json.items?.[0]?.snippet?.title ?? "";
  return { title };
}

/**
 * Fetches up to `max` videos for a channel ordered by view count (search API), then loads statistics.
 */
export async function fetchTopYoutubeVideosByViews(
  apiKey: string,
  channelId: string,
  max: number,
  fetchFn: YoutubeFetchFn = fetch,
  signal?: AbortSignal
): Promise<YoutubeTopVideo[]> {
  const searchJson = (await ytGet(
    "search",
    {
      part: "id",
      channelId,
      maxResults: String(Math.min(Math.max(max, 1), 50)),
      order: "viewCount",
      type: "video",
    },
    apiKey,
    fetchFn,
    signal
  )) as { items?: { id?: { videoId?: string } }[] };

  const ids =
    searchJson.items
      ?.map((it) => it.id?.videoId)
      .filter((x): x is string => typeof x === "string" && x.length > 0) ?? [];

  if (ids.length === 0) return [];

  const statsJson = (await ytGet(
    "videos",
    {
      part: "snippet,statistics",
      id: ids.slice(0, max).join(","),
    },
    apiKey,
    fetchFn,
    signal
  )) as {
    items?: {
      id?: string;
      snippet?: { title?: string };
      statistics?: { viewCount?: string };
    }[];
  };

  const out: YoutubeTopVideo[] = [];
  for (const it of statsJson.items ?? []) {
    const id = it.id;
    if (!id) continue;
    const title = it.snippet?.title ?? "(untitled)";
    const vc = Number(it.statistics?.viewCount ?? 0);
    out.push({ id, title, view_count: Number.isFinite(vc) ? vc : 0 });
  }
  out.sort((a, b) => b.view_count - a.view_count);
  return out.slice(0, max);
}

export type YoutubeChannelSnapshot = {
  youtube_channel_id: string;
  channel_title: string;
  top_videos: YoutubeTopVideo[];
};

/**
 * Full public-data snapshot for a handle (resolve id → snippet + top videos).
 */
export async function fetchYoutubeChannelSnapshot(
  apiKey: string,
  handle: string,
  opts: {
    fetchFn?: YoutubeFetchFn;
    signal?: AbortSignal;
    topVideoCount?: number;
  } = {}
): Promise<YoutubeChannelSnapshot | null> {
  const fetchFn = opts.fetchFn ?? fetch;
  const topN = opts.topVideoCount ?? 10;
  const channelId = await resolveYoutubeChannelId(apiKey, handle, fetchFn, opts.signal);
  if (!channelId) return null;
  const [{ title }, top] = await Promise.all([
    fetchYoutubeChannelSnippet(apiKey, channelId, fetchFn, opts.signal),
    fetchTopYoutubeVideosByViews(apiKey, channelId, topN, fetchFn, opts.signal),
  ]);
  return {
    youtube_channel_id: channelId,
    channel_title: title,
    top_videos: top,
  };
}
