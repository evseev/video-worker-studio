import { describe, it, expect } from "vitest";
import { assignExperimentArm, experimentDecision, CLIP_LIBRARY, EMMA_CHARACTER } from "@/lib/host/character";

describe("host experiment", () => {
  it("alternates arms within a format", () => {
    expect([0, 1, 2, 3].map(assignExperimentArm)).toEqual(["host", "control", "host", "control"]);
  });
  it("adopts on +5 points of 30-second retention", () => {
    const r = experimentDecision({ host: { retention30s: 0.62, subsPer1k: 3, videos: 5 }, control: { retention30s: 0.55, subsPer1k: 3, videos: 5 } });
    expect(r.adopt).toBe(true);
  });
  it("adopts on +30% subscribers per 1K views", () => {
    expect(experimentDecision({ host: { retention30s: 0.55, subsPer1k: 4, videos: 5 }, control: { retention30s: 0.55, subsPer1k: 3, videos: 5 } }).adopt).toBe(true);
  });
  it("needs enough videos", () => {
    expect(experimentDecision({ host: { retention30s: 0.9, subsPer1k: 9, videos: 2 }, control: { retention30s: 0.5, subsPer1k: 1, videos: 5 } }).adopt).toBe(false);
  });
  it("character is explicitly non-photorealistic", () => {
    expect(EMMA_CHARACTER.referencePrompt).toContain("not photorealistic");
    expect(CLIP_LIBRARY.map((c) => c.kind)).toContain("greeting");
  });
});
