import { describe, it, expect } from "vitest";
import {
  generateSeoMetadataPrompt,
  generateSeoMetadataUserMessage,
} from "@/lib/ai/prompts";

describe("generateSeoMetadataPrompt", () => {
  it("includes scene count and duration context", () => {
    const prompt = generateSeoMetadataPrompt({ sceneCount: 6, sceneDuration: 5 });
    expect(prompt).toContain("short-form");
    expect(prompt).toContain("~30 seconds");
  });

  it("uses long-form label for longer videos", () => {
    const prompt = generateSeoMetadataPrompt({ sceneCount: 20, sceneDuration: 30 });
    expect(prompt).toContain("long-form");
    expect(prompt).toContain("~10 minutes");
  });

  it("specifies 20-30 tags", () => {
    const prompt = generateSeoMetadataPrompt({ sceneCount: 6, sceneDuration: 5 });
    expect(prompt).toContain("20-30 tags");
  });

  it("specifies 10-15 hashtags in description", () => {
    const prompt = generateSeoMetadataPrompt({ sceneCount: 6, sceneDuration: 5 });
    expect(prompt).toContain("10-15 relevant hashtags");
  });
});

describe("generateSeoMetadataUserMessage", () => {
  const scenes = [
    { scriptText: "Welcome to the video" },
    { scriptText: "Here is the main point" },
  ];

  it("includes idea and scene scripts", () => {
    const msg = generateSeoMetadataUserMessage("Top 10 facts", scenes);
    expect(msg).toContain("Video idea: Top 10 facts");
    expect(msg).toContain("Scene 1: Welcome to the video");
    expect(msg).toContain("Scene 2: Here is the main point");
  });

  it("includes target keywords when provided", () => {
    const msg = generateSeoMetadataUserMessage("Top 10 facts", scenes, "amazing facts trivia");
    expect(msg).toContain("Target keywords: amazing facts trivia");
  });

  it("omits target keywords when empty", () => {
    const msg = generateSeoMetadataUserMessage("Top 10 facts", scenes, "");
    expect(msg).not.toContain("Target keywords");
  });

  it("omits target keywords when undefined", () => {
    const msg = generateSeoMetadataUserMessage("Top 10 facts", scenes);
    expect(msg).not.toContain("Target keywords");
  });
});
