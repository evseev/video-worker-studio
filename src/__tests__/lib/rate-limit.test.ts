import { describe, it, expect } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  it("allows requests under the limit", () => {
    const key = `test-under-${Date.now()}`;
    expect(rateLimit(key, 5, 60_000)).toBeNull();
    expect(rateLimit(key, 5, 60_000)).toBeNull();
    expect(rateLimit(key, 5, 60_000)).toBeNull();
  });

  it("blocks requests over the limit", () => {
    const key = `test-over-${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(key, 3, 60_000)).toBeNull();
    }
    const blocked = rateLimit(key, 3, 60_000);
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
  });

  it("resets after window expires", async () => {
    const key = `test-reset-${Date.now()}`;
    // Use a very short window
    expect(rateLimit(key, 1, 50)).toBeNull();
    expect(rateLimit(key, 1, 50)).not.toBeNull(); // blocked

    await new Promise((r) => setTimeout(r, 60));

    expect(rateLimit(key, 1, 50)).toBeNull(); // allowed again
  });

  it("tracks different keys independently", () => {
    const key1 = `test-key1-${Date.now()}`;
    const key2 = `test-key2-${Date.now()}`;
    expect(rateLimit(key1, 1, 60_000)).toBeNull();
    expect(rateLimit(key1, 1, 60_000)).not.toBeNull(); // key1 blocked
    expect(rateLimit(key2, 1, 60_000)).toBeNull(); // key2 still allowed
  });
});
