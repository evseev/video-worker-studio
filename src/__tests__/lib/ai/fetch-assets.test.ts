import { describe, it, expect, vi, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Do NOT set PINTEREST_DL_BIN — tests use the "not set" codepath which
// returns [] per keyword without spawning a process. We then pre-create
// image files to test the return-type contract via a separate wrapper.

import { fetchAssets } from "@/lib/ai/fetch-assets";

const tmpDir = path.join(process.cwd(), "public/tmp_assets/vws-assets");

describe("fetchAssets", () => {
  afterEach(() => {
    for (const dir of ["test-1", "test-2", "test-3", "test-4"]) {
      fs.rmSync(path.join(tmpDir, dir), { recursive: true, force: true });
    }
  });

  it("returns null for null keywords when count=1 (default)", async () => {
    const result = await fetchAssets([null], "test-1");

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0]).toBeNull();
  });

  it("returns empty array for null keywords when count > 1", async () => {
    const result = await fetchAssets([null], "test-2", 3);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual([]);
  });

  it("handles multiple keywords in a batch", async () => {
    const result = await fetchAssets([null, null, null], "test-3");

    expect(result).toHaveLength(3);
    expect(result.every((r) => r === null)).toBe(true);
  });

  it("handles mixed null and non-null keywords", async () => {
    // Non-null keywords will hit the "PINTEREST_DL_BIN not set" path and return []
    // which maps to null for count=1
    const result = await fetchAssets([null, "sunset", null], "test-4");

    expect(result).toHaveLength(3);
    expect(result[0]).toBeNull();
    // "sunset" with no binary returns null (empty dir → no files → null)
    expect(result[1]).toBeNull();
    expect(result[2]).toBeNull();
  });
});
