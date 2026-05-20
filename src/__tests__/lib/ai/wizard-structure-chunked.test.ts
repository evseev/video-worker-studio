import { describe, expect, it, vi } from "vitest";
import type { Scene } from "@/templates/types";

// Stub the Gemini client construction so importing `wizard.ts` doesn't require
// GEMINI_API_KEY. `generateStructureChunked` reaches the real model only when
// no `chunkGenerator` injection is provided.
vi.mock("@/lib/ai/gemini", () => ({
  GEMINI_TEXT_MODEL: "test-model",
  GEMINI_EMBEDDING_MODEL: "test-embed",
  createGeminiClient: () => ({}),
  getTextModel: () => ({}),
  generateTextOrThrow: vi.fn(),
  getEmbeddingModel: () => ({}),
  embedTextOrThrow: vi.fn(),
}));

import { generateStructureChunked, type StructureChunkRequest } from "@/lib/ai/wizard";

function comparisonScene(subjectKey: string): Scene {
  return {
    template: "comparison",
    subjectKey,
    scriptText: `narration about ${subjectKey}`,
    captionText: subjectKey,
    searchKeywords: ["left", "right"],
    leftLabel: "Before",
    rightLabel: "After",
    assets: [{}, {}],
  };
}

describe("generateStructureChunked", () => {
  it("delivers the exact count with all-unique subjects when the model undershoots each chunk", async () => {
    // Realistic Gemini behavior: always returns chunkSize - 1, but respects excludes
    // and offers fresh names from a large enough pool.
    const pool = Array.from({ length: 100 }, (_, i) => `Sub-${i}`);
    const chunkGenerator = async (req: StructureChunkRequest): Promise<Scene[]> => {
      const excluded = new Set((req.excludeSubjects ?? []).map((s) => s.toLowerCase()));
      const want = Math.max(0, req.chunkSize - 1);
      const result: Scene[] = [];
      for (const name of pool) {
        if (excluded.has(name.toLowerCase())) continue;
        result.push(comparisonScene(name));
        if (result.length >= want) break;
      }
      return result;
    };

    const scenes = await generateStructureChunked("idea", "comparison", {
      sceneCount: 63,
      sceneDuration: 5,
      chunkGenerator,
    });

    expect(scenes).toHaveLength(63);
    expect(new Set(scenes.map((s) => s.subjectKey)).size).toBe(63);
  });

  it("regression: dedupes when the model partly ignores the exclude list (Donatella Versace bug)", async () => {
    // Half-compliant model: returns floor(want/2) duplicates from the exclude list
    // plus ceil(want/2) novel subjects. This is exactly what produced 4× Donatella
    // Versace etc. before the in-run filter + top-up loop landed.
    const pool = Array.from({ length: 80 }, (_, i) => `Sub-${i}`);
    const chunkGenerator = async (req: StructureChunkRequest): Promise<Scene[]> => {
      const excluded = new Set((req.excludeSubjects ?? []).map((s) => s.toLowerCase()));
      const want = Math.max(0, req.chunkSize - 1);
      const dupeCount = Math.floor(want / 2);
      const novelCount = want - dupeCount;
      const dupes = pool.filter((s) => excluded.has(s.toLowerCase())).slice(0, dupeCount);
      const novel = pool.filter((s) => !excluded.has(s.toLowerCase())).slice(0, novelCount);
      return [...dupes, ...novel].map(comparisonScene);
    };

    const scenes = await generateStructureChunked("idea", "comparison", {
      sceneCount: 63,
      sceneDuration: 5,
      chunkGenerator,
    });

    expect(scenes).toHaveLength(63);
    const counts = new Map<string, number>();
    for (const s of scenes) {
      counts.set(s.subjectKey, (counts.get(s.subjectKey) ?? 0) + 1);
    }
    const dupes = [...counts.entries()].filter(([, n]) => n > 1);
    expect(dupes).toEqual([]);
  });

  it("grows the prompt exclude list as chunks accumulate accepted subjects", async () => {
    const requests: StructureChunkRequest[] = [];
    const pool = Array.from({ length: 50 }, (_, i) => `Sub-${i}`);
    const chunkGenerator = async (req: StructureChunkRequest): Promise<Scene[]> => {
      requests.push(req);
      const excluded = new Set((req.excludeSubjects ?? []).map((s) => s.toLowerCase()));
      const want = Math.max(0, req.chunkSize - 1);
      return pool
        .filter((s) => !excluded.has(s.toLowerCase()))
        .slice(0, want)
        .map(comparisonScene);
    };

    await generateStructureChunked("idea", "comparison", {
      sceneCount: 40,
      sceneDuration: 5,
      chunkGenerator,
    });

    expect(requests.length).toBeGreaterThanOrEqual(2);
    expect((requests[0].excludeSubjects ?? []).length).toBe(0);
    for (let i = 1; i < requests.length; i += 1) {
      const prev = (requests[i - 1].excludeSubjects ?? []).length;
      const curr = (requests[i].excludeSubjects ?? []).length;
      expect(curr).toBeGreaterThan(prev);
    }
  });

  it("bails out cleanly when the model exhausts its known subjects", async () => {
    // The model knows only 3 distinct subjects. It must NOT loop forever asking
    // for 25, and must return what it has.
    const tinyKnowledge = ["one", "two", "three"];
    const chunkGenerator = async (req: StructureChunkRequest): Promise<Scene[]> => {
      const excluded = new Set((req.excludeSubjects ?? []).map((s) => s.toLowerCase()));
      return tinyKnowledge.filter((s) => !excluded.has(s)).map(comparisonScene);
    };

    const scenes = await generateStructureChunked("idea", "comparison", {
      sceneCount: 25,
      sceneDuration: 5,
      chunkGenerator,
    });

    expect(scenes.map((s) => s.subjectKey)).toEqual(["one", "two", "three"]);
  });

  it("filters subjects that overlap channel cross-video memory", async () => {
    // `excludeSubjects` is matched after running `normalizeSubject`, which collapses
    // case + punctuation + whitespace. "Banned Hero!" and "banned hero" must collide.
    const chunkGenerator = async (req: StructureChunkRequest): Promise<Scene[]> => {
      return ["Banned Hero!", "ok-1", "ok-2", "ok-3", "ok-4"]
        .slice(0, req.chunkSize)
        .map(comparisonScene);
    };

    const scenes = await generateStructureChunked("idea", "comparison", {
      sceneCount: 3,
      sceneDuration: 5,
      excludeSubjects: ["banned hero"],
      chunkGenerator,
    });

    expect(scenes.map((s) => s.subjectKey)).toEqual(["ok-1", "ok-2", "ok-3"]);
  });
});
