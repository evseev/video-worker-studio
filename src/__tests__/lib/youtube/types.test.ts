import { describe, it, expect } from "vitest";
import {
  isYoutubeMetaFresh,
  parseStoredYoutubeMeta,
  TWENTY_FOUR_H_MS,
} from "@/lib/youtube/types";

describe("YouTube meta cache helpers", () => {
  it("parseStoredYoutubeMeta rejects malformed payloads", () => {
    expect(parseStoredYoutubeMeta(null)).toBeNull();
    expect(parseStoredYoutubeMeta({ fetched_at: "x", top_videos: "bad" })).toBeNull();
  });

  it("isYoutubeMetaFresh is false outside 24h window", () => {
    const old = new Date(Date.now() - TWENTY_FOUR_H_MS - 60_000).toISOString();
    expect(
      isYoutubeMetaFresh({ fetched_at: old, top_videos: [] }, Date.now())
    ).toBe(false);
  });

  it("isYoutubeMetaFresh is true inside 24h window", () => {
    const recent = new Date(Date.now() - 60_000).toISOString();
    expect(
      isYoutubeMetaFresh({ fetched_at: recent, top_videos: [] }, Date.now())
    ).toBe(true);
  });
});
