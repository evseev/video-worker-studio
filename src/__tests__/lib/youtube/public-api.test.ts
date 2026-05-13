import { describe, it, expect, vi } from "vitest";
import {
  resolveYoutubeChannelId,
  fetchYoutubeChannelSnippet,
  fetchTopYoutubeVideosByViews,
  fetchYoutubeChannelSnapshot,
} from "@/lib/youtube/public-api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("YouTube public-api (mocked fetch)", () => {
  it("resolveYoutubeChannelId strips @ and returns first item id", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ items: [{ id: "UCabc" }] })
    );
    const id = await resolveYoutubeChannelId("key", "@MyHandle", fetchFn);
    expect(id).toBe("UCabc");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const url = fetchFn.mock.calls[0][0] as string;
    expect(url).toContain("googleapis.com/youtube/v3/channels");
    expect(url).toContain("forHandle=MyHandle");
  });

  it("resolveYoutubeChannelId returns null on empty handle", async () => {
    const fetchFn = vi.fn();
    expect(await resolveYoutubeChannelId("key", "   ", fetchFn)).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("fetchYoutubeChannelSnippet reads title from items[0]", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ items: [{ snippet: { title: "Hello" } }] })
    );
    const out = await fetchYoutubeChannelSnippet("key", "UCx", fetchFn);
    expect(out).toEqual({ title: "Hello" });
  });

  it("ytGet throws with API error message on non-OK", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ error: { message: "quota" } }, 403)
    );
    await expect(resolveYoutubeChannelId("key", "h", fetchFn)).rejects.toThrow(/quota/);
  });

  it("fetchTopYoutubeVideosByViews chains search then videos", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          items: [{ id: { videoId: "v1" } }, { id: { videoId: "v2" } }],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            { id: "v1", snippet: { title: "A" }, statistics: { viewCount: "10" } },
            { id: "v2", snippet: { title: "B" }, statistics: { viewCount: "99" } },
          ],
        })
      );

    const top = await fetchTopYoutubeVideosByViews("key", "UCc", 10, fetchFn);
    expect(top.map((t) => t.id)).toEqual(["v2", "v1"]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("fetchYoutubeChannelSnapshot returns null when handle does not resolve", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ items: [] }));
    const snap = await fetchYoutubeChannelSnapshot("key", "@ghost", { fetchFn });
    expect(snap).toBeNull();
  });
});
