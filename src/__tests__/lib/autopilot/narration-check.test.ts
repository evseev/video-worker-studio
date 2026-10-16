import { describe, it, expect } from "vitest";
import { narrationSimilarity, normalizeForCompare, tokensToLines, NARRATION_SIMILARITY_THRESHOLD } from "@/lib/qa/narration-check";

describe("narration QA", () => {
  it("normalises tags, punctuation and small numbers", () => {
    expect(normalizeForCompare("[warm] They have *three* children, aged 9!")).toEqual(["they", "have", "3", "children", "aged", "9"]);
  });

  it("accepts the real Soniox transcript of a line (name spelling variants)", () => {
    const script = "Kevin Bacon and Kyra Sedgwick walked down the aisle in 1988, creating a loving home for their two children, Sosie and Travis.";
    const heard = "Kevin Bacon and Kyra Sedgewick walked down the aisle in 1988, creating a loving home for their 2 children, Sosie and Travis.";
    expect(narrationSimilarity(script, heard)).toBeGreaterThan(0.95);
  });

  it("flags a truncated line", () => {
    const script = "Michael J. Fox and Tracy Pollan became husband and wife in 1988, welcoming four children named Sam, Aquinnah, Schuyler, and Esmé.";
    const heard = "Michael J. Fox and Tracy Pollan became husband and wife.";
    expect(narrationSimilarity(script, heard)).toBeLessThan(NARRATION_SIMILARITY_THRESHOLD);
  });

  it("assigns tokens to lines by time", () => {
    const tokens = [
      { text: "Hello", start_ms: 100, end_ms: 400 },
      { text: " there", start_ms: 450, end_ms: 800 },
      { text: "Second", start_ms: 2100, end_ms: 2500 },
      { text: " line", start_ms: 2550, end_ms: 2900 },
    ];
    expect(tokensToLines(tokens, [{ start: 0, end: 1500 }, { start: 1500, end: 4000 }])).toEqual(["Hello there", "Second line"]);
  });
});
