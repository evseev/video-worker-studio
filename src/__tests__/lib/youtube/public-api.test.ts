import { describe, it, expect, vi } from "vitest";
import { resolveYoutubeChannelId, fetchTopYoutubeVideosByViews } from "@/lib/youtube/public-api";

describe("lib/youtube/public-api", () => {
  it("resolveYoutubeChannelId strips @ and returns first channel id", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ id: "UCabc" }] }),
    });
    const id = await resolveYoutubeChannelId("key", "@MyBrand", fetchFn as typeof fetch);
    expect(id).toBe("UCabc");
    expect(fetchFn).toHaveBeenCalled();
    const url = String(fetchFn.mock.calls[0][0]);
    expect(url).toContain("forHandle=MyBrand");
  });

  it("fetchTopYoutubeVideosByViews merges search + videos responses", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ id: { videoId: "v1" } }, { id: { videoId: "v2" } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            { id: "v1", snippet: { title: "A" }, statistics: { viewCount: "10" } },
            { id: "v2", snippet: { title: "B" }, statistics: { viewCount: "99" } },
          ],
        }),
      });

    const rows = await fetchTopYoutubeVideosByViews("key", "UCx", 10, fetchFn as typeof fetch);
    expect(rows[0].id).toBe("v2");
    expect(rows[0].view_count).toBe(99);
  });
});
