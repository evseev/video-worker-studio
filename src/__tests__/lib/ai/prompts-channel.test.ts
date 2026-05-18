import { describe, it, expect } from "vitest";
import {
  buildChannelContextPreamble,
  enhanceIdeaPrompt,
  generateSeoMetadataPrompt,
} from "@/lib/ai/prompts";

describe("buildChannelContextPreamble", () => {
  it("returns empty string when all fields absent", () => {
    expect(buildChannelContextPreamble({})).toBe("");
    expect(buildChannelContextPreamble({ niche: "  " })).toBe("");
  });

  it("includes only non-empty fields", () => {
    const p = buildChannelContextPreamble({
      niche: "Tech",
      targetAudience: "Adults",
    });
    expect(p).toContain("- Niche: Tech");
    expect(p).toContain("- Target audience: Adults");
    expect(p).not.toContain("Target language");
    expect(p).not.toContain("Tone:");
  });

  it("matches full identity block when all four set", () => {
    expect(
      buildChannelContextPreamble({
        niche: "Cooking",
        targetLanguage: "en",
        targetAudience: "Home cooks",
        tone: "Warm",
      })
    ).toMatchSnapshot();
  });
});

describe("channel preamble prepended to prompt builders", () => {
  it("snapshot: enhanceIdeaPrompt before/after channelContext", () => {
    expect(enhanceIdeaPrompt({ totalDuration: 120 })).toMatchSnapshot("no-context");
    expect(
      enhanceIdeaPrompt({
        totalDuration: 120,
        channelContext: { niche: "X", targetLanguage: "en", targetAudience: "Y", tone: "Z" },
      })
    ).toMatchSnapshot("with-context");
  });

  it("generateSeoMetadataPrompt prepends preamble when channelContext set", () => {
    const base = generateSeoMetadataPrompt({ sceneCount: 6, sceneDuration: 5 });
    const withCtx = generateSeoMetadataPrompt({
      sceneCount: 6,
      sceneDuration: 5,
      channelContext: { niche: "Gaming" },
    });
    expect(base.startsWith("You are a YouTube SEO specialist")).toBe(true);
    expect(withCtx.startsWith("You are writing video content")).toBe(true);
    expect(withCtx).toContain("You are a YouTube SEO specialist");
  });
});
