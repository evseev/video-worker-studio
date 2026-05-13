import { describe, it, expect, vi, beforeEach } from "vitest";
import { refreshChannelYoutubeIfNeeded } from "@/lib/youtube/sync-channel-youtube";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/channels/repository", () => ({
  getChannelById: vi.fn(),
  updateChannel: vi.fn(),
}));

import { getChannelById, updateChannel } from "@/lib/channels/repository";

const freshMeta = {
  fetched_at: new Date(Date.now() - 60_000).toISOString(),
  channel_title: "Cached",
  top_videos: [{ id: "v1", title: "T", view_count: 1 }],
};

describe("refreshChannelYoutubeIfNeeded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 503 when YOUTUBE_API_KEY is missing", async () => {
    vi.mocked(getChannelById).mockResolvedValueOnce({
      data: {
        id: "c1",
        youtube_handle: "@x",
        youtube_meta: {},
      },
      error: null,
    });
    const out = await refreshChannelYoutubeIfNeeded({} as SupabaseClient, "c1", {
      apiKey: undefined,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(503);
  });

  it("skips network when meta is fresh and force is false", async () => {
    vi.mocked(getChannelById).mockResolvedValueOnce({
      data: {
        id: "c1",
        youtube_handle: "@x",
        youtube_meta: freshMeta,
      },
      error: null,
    });
    const fetchFn = vi.fn();
    const out = await refreshChannelYoutubeIfNeeded({} as SupabaseClient, "c1", {
      apiKey: "k",
      fetchFn,
      force: false,
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.refreshed).toBe(false);
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("refetches when force is true even if cache is fresh", async () => {
    vi.mocked(getChannelById).mockResolvedValueOnce({
      data: {
        id: "c1",
        youtube_handle: "@x",
        youtube_meta: freshMeta,
      },
      error: null,
    });

    vi.mocked(updateChannel).mockResolvedValue({
      data: {
        id: "c1",
        youtube_handle: "@x",
        youtube_meta: {
          fetched_at: new Date().toISOString(),
          channel_title: "New",
          top_videos: [],
        },
      },
      error: null,
    });

    const fetchFn = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/channels") && url.includes("forHandle")) {
        return new Response(JSON.stringify({ items: [{ id: "UCnew" }] }), { status: 200 });
      }
      if (url.includes("/channels") && url.includes("part=snippet")) {
        return new Response(JSON.stringify({ items: [{ snippet: { title: "New" } }] }), {
          status: 200,
        });
      }
      if (url.includes("/search")) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 });
      }
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    });

    const out = await refreshChannelYoutubeIfNeeded({} as SupabaseClient, "c1", {
      apiKey: "key",
      fetchFn,
      force: true,
    });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.refreshed).toBe(true);
    expect(fetchFn).toHaveBeenCalled();
  });
});
