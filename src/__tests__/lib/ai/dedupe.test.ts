import { describe, expect, it } from "vitest";
import { normalizeSubject } from "@/lib/ai/dedupe";

describe("normalizeSubject", () => {
  it("normalizes case, punctuation, and spaces", () => {
    expect(normalizeSubject("  Tom   Cruise!!!  ")).toBe("tom cruise");
  });

  it("keeps alphanumeric words", () => {
    expect(normalizeSubject("Top Gun 2 Maverick")).toBe("top gun 2 maverick");
  });

  it("returns empty string for punctuation-only inputs", () => {
    expect(normalizeSubject("... !!!")).toBe("");
  });
});
