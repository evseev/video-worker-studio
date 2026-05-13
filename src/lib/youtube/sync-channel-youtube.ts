import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { getChannelById, updateChannel } from "@/lib/channels/repository";
import { fetchYoutubeChannelSnapshot, type YoutubeFetchFn } from "@/lib/youtube/public-api";
import { isYoutubeMetaFresh } from "@/lib/youtube/types";

export type RefreshYoutubeResult =
  | { ok: true; channel: NonNullable<Awaited<ReturnType<typeof getChannelById>>["data"]>; refreshed: boolean }
  | { ok: false; status: number; error: string };

/**
 * Refreshes `youtube_meta` + `youtube_channel_id` when stale or `force`.
 * Uses 24h freshness stored in `youtube_meta.fetched_at`.
 */
export async function refreshChannelYoutubeIfNeeded(
  supabase: SupabaseClient<Database>,
  channelId: string,
  opts: {
    force?: boolean;
    apiKey: string | undefined;
    fetchFn?: YoutubeFetchFn;
    signal?: AbortSignal;
  }
): Promise<RefreshYoutubeResult> {
  const { data: row, error } = await getChannelById(supabase, channelId);
  if (error || !row) {
    return { ok: false, status: 403, error: "Channel not found" };
  }

  const handle = row.youtube_handle?.trim();
  if (!handle) {
    return { ok: false, status: 400, error: "youtube_handle is not set" };
  }

  if (!opts.apiKey) {
    return {
      ok: false,
      status: 503,
      error: "YOUTUBE_API_KEY is not configured",
    };
  }

  const fresh = isYoutubeMetaFresh(row.youtube_meta) && !opts.force;
  if (fresh) {
    return { ok: true, channel: row, refreshed: false };
  }

  try {
    const snap = await fetchYoutubeChannelSnapshot(opts.apiKey, handle, {
      fetchFn: opts.fetchFn,
      signal: opts.signal,
      topVideoCount: 10,
    });
    if (!snap) {
      const meta: Json = {
        fetched_at: new Date().toISOString(),
        error: "Could not resolve YouTube channel for this handle",
        top_videos: [],
      };
      const { data: updated, error: upErr } = await updateChannel(supabase, channelId, {
        youtube_meta: meta,
      });
      if (upErr || !updated) {
        return { ok: false, status: 500, error: upErr?.message ?? "Update failed" };
      }
      return { ok: true, channel: updated, refreshed: true };
    }

    const meta: Json = {
      fetched_at: new Date().toISOString(),
      channel_title: snap.channel_title,
      top_videos: snap.top_videos,
    };

    const { data: updated, error: upErr } = await updateChannel(supabase, channelId, {
      youtube_channel_id: snap.youtube_channel_id,
      youtube_meta: meta,
    });
    if (upErr || !updated) {
      return { ok: false, status: 500, error: upErr?.message ?? "Update failed" };
    }
    return { ok: true, channel: updated, refreshed: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const meta: Json = {
      fetched_at: new Date().toISOString(),
      error: message,
      top_videos: [],
    };
    const { data: updated, error: upErr } = await updateChannel(supabase, channelId, {
      youtube_meta: meta,
    });
    if (upErr || !updated) {
      return { ok: false, status: 502, error: message };
    }
    return { ok: true, channel: updated, refreshed: true };
  }
}
