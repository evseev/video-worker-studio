import { describe, expect, it, vi } from "vitest";
import type { Scene } from "@/templates/types";

vi.mock("@/lib/ai/gemini", () => ({
  GEMINI_TEXT_MODEL: "test-model",
  GEMINI_EMBEDDING_MODEL: "test-embed",
  createGeminiClient: () => ({}),
  getTextModel: () => ({}),
  generateTextOrThrow: vi.fn(),
  getEmbeddingModel: () => ({}),
  embedTextOrThrow: vi.fn(),
}));

import {
  generateStructurePlanned,
  planSubjects,
  type StructureChunkRequest,
  type SubjectPlanRequest,
} from "@/lib/ai/wizard";

function comparisonSceneFor(subjectKey: string): Scene {
  return {
    template: "comparison",
    subjectKey,
    scriptText: `narration about ${subjectKey}`,
    captionText: subjectKey,
    searchKeywords: [`${subjectKey} left`, `${subjectKey} right`],
    leftLabel: "Before",
    rightLabel: "After",
    assets: [{}, {}],
  };
}

describe("planSubjects", () => {
  it("collects subjects across angle hints and dedupes them", async () => {
    const calls: SubjectPlanRequest[] = [];
    const planSubjectsCall = async (req: SubjectPlanRequest): Promise<string[]> => {
      calls.push(req);
      // 1st angle: returns 10 names — some overlap the channel exclude list.
      if (calls.length === 1) {
        return ["Excluded One", "Subject A", "Subject B", "Subject C", "Subject D",
                "Subject E", "Subject F", "Subject G", "Subject H", "Subject I"];
      }
      // 2nd angle: returns 8 more names — 3 dupes from before, 5 new.
      return ["subject a", "Subject B", "Subject J", "Subject K", "Subject L",
              "Subject M", "Subject N", "subject c"];
    };

    const result = await planSubjects({
      idea: "any idea",
      sceneCount: 13,
      sceneDuration: 5,
      channelExcludes: ["excluded one"],
      planSubjectsCall,
    });

    expect(result).toHaveLength(13);
    // Exactly the 9 unique from call 1 (channel exclude dropped) + 4 new from call 2.
    expect(new Set(result.map((s) => s.toLowerCase())).size).toBe(13);
    expect(result.map((s) => s.toLowerCase())).toContain("subject a");
    expect(result.map((s) => s.toLowerCase())).not.toContain("excluded one");

    // 2nd call's exclude list must contain everything accepted from call 1.
    const secondCallExcludes = calls[1].excludeSubjects.map((s) => s.toLowerCase());
    expect(secondCallExcludes).toContain("subject a");
    expect(secondCallExcludes).toContain("subject i");
  });

  it("stops at sceneCount even when the model returns extras", async () => {
    const planSubjectsCall = async (): Promise<string[]> => {
      return Array.from({ length: 50 }, (_, i) => `S-${i}`);
    };
    const result = await planSubjects({
      idea: "any",
      sceneCount: 12,
      sceneDuration: 5,
      channelExcludes: [],
      planSubjectsCall,
    });
    expect(result).toHaveLength(12);
  });

  it("returns fewer than sceneCount when the model truly exhausts its knowledge", async () => {
    const planSubjectsCall = async (): Promise<string[]> => ["Only", "Three", "Subjects"];
    const result = await planSubjects({
      idea: "narrow",
      sceneCount: 25,
      sceneDuration: 5,
      channelExcludes: [],
      planSubjectsCall,
    });
    expect(result).toEqual(["Only", "Three", "Subjects"]);
  });

  it("survives a single planning-call exception by trying the next angle hint", async () => {
    let call = 0;
    const planSubjectsCall = async (): Promise<string[]> => {
      call += 1;
      if (call === 1) throw new Error("temporary failure");
      return ["A", "B", "C"];
    };
    const result = await planSubjects({
      idea: "any",
      sceneCount: 3,
      sceneDuration: 5,
      channelExcludes: [],
      planSubjectsCall,
    });
    expect(result).toEqual(["A", "B", "C"]);
  });
});

describe("generateStructurePlanned", () => {
  it("delivers the requested sceneCount with all subjectKeys aligned to the plan", async () => {
    const plannedPool = Array.from({ length: 80 }, (_, i) => `Subject-${i}`);
    const planSubjectsCall = async (req: SubjectPlanRequest): Promise<string[]> => {
      // Return a generous slice from the deterministic pool.
      return plannedPool.slice(0, Math.min(plannedPool.length, req.askFor));
    };
    const requests: StructureChunkRequest[] = [];
    const chunkGenerator = async (req: StructureChunkRequest): Promise<Scene[]> => {
      requests.push(req);
      // Faithful model: emits one scene per assigned subject, in order.
      return (req.assignedSubjects ?? []).map(comparisonSceneFor);
    };

    const scenes = await generateStructurePlanned("idea", "comparison", {
      sceneCount: 64,
      sceneDuration: 5,
      chunkGenerator,
      planSubjectsCall,
    });

    expect(scenes).toHaveLength(64);
    expect(new Set(scenes.map((s) => s.subjectKey)).size).toBe(64);
    expect(scenes.map((s) => s.subjectKey)).toEqual(plannedPool.slice(0, 64));

    // Every chunk request had assignedSubjects set.
    expect(requests.every((r) => (r.assignedSubjects ?? []).length > 0)).toBe(true);
    // Total subjects assigned across all chunks == sceneCount.
    const totalAssigned = requests.reduce((n, r) => n + (r.assignedSubjects?.length ?? 0), 0);
    expect(totalAssigned).toBe(64);
  });

  it("retries subjects when a batch returns fewer scenes than assigned", async () => {
    const planSubjectsCall = async (): Promise<string[]> => ["A", "B", "C", "D", "E"];

    let call = 0;
    const chunkGenerator = async (req: StructureChunkRequest): Promise<Scene[]> => {
      call += 1;
      const subs = req.assignedSubjects ?? [];
      // First call returns scenes for only the first 3 subjects.
      if (call === 1) return subs.slice(0, 3).map(comparisonSceneFor);
      // Retry returns scenes for whatever's left.
      return subs.map(comparisonSceneFor);
    };

    const scenes = await generateStructurePlanned("idea", "comparison", {
      sceneCount: 5,
      sceneDuration: 5,
      chunkGenerator,
      planSubjectsCall,
    });

    expect(scenes.map((s) => s.subjectKey)).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("forces subjectKey alignment even when the model returns a different name", async () => {
    const planSubjectsCall = async (): Promise<string[]> => ["Alpha", "Beta"];
    const chunkGenerator: (req: StructureChunkRequest) => Promise<Scene[]> = async () => {
      // Model totally ignores assignment and returns its favorite subjects.
      return [comparisonSceneFor("Random One"), comparisonSceneFor("Random Two")];
    };

    const scenes = await generateStructurePlanned("idea", "comparison", {
      sceneCount: 2,
      sceneDuration: 5,
      chunkGenerator,
      planSubjectsCall,
    });

    // Positional fallback aligns scenes to the plan; subjectKey is forced.
    expect(scenes.map((s) => s.subjectKey)).toEqual(["Alpha", "Beta"]);
  });

  it("returns no scenes when planning yields no subjects", async () => {
    const planSubjectsCall = async (): Promise<string[]> => [];
    const chunkGenerator = vi.fn();

    const scenes = await generateStructurePlanned("idea", "comparison", {
      sceneCount: 10,
      sceneDuration: 5,
      chunkGenerator,
      planSubjectsCall,
    });

    expect(scenes).toEqual([]);
    expect(chunkGenerator).not.toHaveBeenCalled();
  });
});
