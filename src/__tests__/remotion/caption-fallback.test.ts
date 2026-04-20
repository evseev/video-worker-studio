import { describe, it, expect } from "vitest";
import { resolveCaption } from "@/remotion/caption-fallback";

describe("resolveCaption (Epic 23)", () => {
  it("returns captionText when it has non-whitespace content", () => {
    expect(resolveCaption("Tom Cruise", "The most iconic 90s star was Tom Cruise.")).toBe("Tom Cruise");
  });

  it("falls back to scriptText when captionText is undefined (legacy scene)", () => {
    expect(resolveCaption(undefined, "Legacy narration")).toBe("Legacy narration");
  });

  it("falls back to scriptText when captionText is null", () => {
    expect(resolveCaption(null, "Legacy narration")).toBe("Legacy narration");
  });

  it("falls back to scriptText when captionText is an empty string", () => {
    expect(resolveCaption("", "Narration")).toBe("Narration");
  });

  it("falls back to scriptText when captionText is only whitespace", () => {
    expect(resolveCaption("   \n\t  ", "Narration")).toBe("Narration");
  });

  it("preserves the exact captionText (no trimming)", () => {
    expect(resolveCaption("  padded  ", "fallback")).toBe("  padded  ");
  });
});
