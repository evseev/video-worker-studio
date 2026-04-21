import { describe, expect, it, beforeEach } from "vitest";

describe("fetchAssetsBatched", () => {
  beforeEach(() => {
    process.env.PINTEREST_BATCH_SIZE = "2";
    process.env.PINTEREST_BATCH_PAUSE_MS = "1";
    process.env.PINTEREST_CONCURRENCY = "2";
  });

  it("yields batched results with expected boundaries", async () => {
    const { fetchAssetsBatched } = await import("@/lib/ai/fetch-assets");
    const keywords = Array.from({ length: 121 }, () => null);
    const batches = [];
    for await (const batch of fetchAssetsBatched(
      keywords,
      "proj-test",
      1
    )) {
      batches.push(batch);
    }

    expect(batches.length).toBeGreaterThan(1);
    expect(batches[0].startIndex).toBe(0);
    expect(batches[1].startIndex).toBeGreaterThan(0);
    expect(batches[2].startIndex).toBeGreaterThan(batches[1].startIndex);
    expect(batches[0].batchCount).toBe(batches.length);
  }, 30_000);

  it("honors env fallbacks when values are invalid", async () => {
    const { fetchAssetsBatched } = await import("@/lib/ai/fetch-assets");
    process.env.PINTEREST_BATCH_SIZE = "-1";
    process.env.PINTEREST_BATCH_PAUSE_MS = "bad";
    process.env.PINTEREST_CONCURRENCY = "0";

    const batches = [];
    for await (const batch of fetchAssetsBatched([null, null], "proj-test", 1)) {
      batches.push(batch);
    }
    expect(batches).toHaveLength(1);
  });
});
