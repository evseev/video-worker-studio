import { describe, it, expect } from "vitest";
import { isYoutubeMetaFresh, TWENTY_FOUR_H_MS } from "@/lib/youtube/types";

describe("lib/youtube/types", () => {
  it("isYoutubeMetaFresh returns true within 24h", () => {
    const now = Date.parse("2026-05-13T12:00:00.000Z");
    const meta = { fetched_at: "2026-05-13T11:00:00.000Z" };
    expect(isYoutubeMetaFresh(meta, now)).toBe(true);
  });

  it("isYoutubeMetaFresh returns false after 24h", () => {
    const now = Date.parse("2026-05-15T12:00:00.000Z");
    const meta = { fetched_at: "2026-05-13T12:00:00.000Z" };
    expect(isYoutubeMetaFresh(meta, now)).toBe(false);
    expect(now - Date.parse("2026-05-13T12:00:00.000Z")).toBeGreaterThan(TWENTY_FOUR_H_MS);
  });
});
