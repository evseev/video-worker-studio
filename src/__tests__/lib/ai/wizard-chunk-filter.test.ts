import { describe, expect, it } from "vitest";
import { filterScenesAgainstChannelMemory } from "@/lib/ai/wizard-structure-chunk-filter";
import type { Scene } from "@/templates/types";

function slideshowScene(subjectKey: string): Scene {
  return {
    template: "slideshow",
    subjectKey,
    scriptText: "narration",
    captionText: "caption",
    searchKeywords: ["kw"],
    assets: [{}],
  };
}

describe("filterScenesAgainstChannelMemory", () => {
  it("drops scenes whose subject matches channel cross-video memory", () => {
    const channel = new Set(["forbidden persona"]);
    const scenes = [
      slideshowScene("Forbidden Persona"),
      slideshowScene("allowed one"),
      slideshowScene("allowed two"),
    ];
    const result = filterScenesAgainstChannelMemory(scenes, channel, 0);
    expect(result.droppedChannelCount).toBe(1);
    expect(result.droppedDuplicateCount).toBe(0);
    expect(result.droppedCount).toBe(1);
    expect(result.uniqueScenes.map((s) => s.subjectKey)).toEqual(["allowed one", "allowed two"]);
    expect(result.acceptedNormalized).toEqual(["allowed one", "allowed two"]);
  });

  it("drops intra-chunk duplicate subjects", () => {
    const scenes = [
      slideshowScene("Donatella Versace"),
      slideshowScene("Cher"),
      slideshowScene("donatella  versace!"),
    ];
    const result = filterScenesAgainstChannelMemory(scenes, new Set(), 0);
    expect(result.droppedDuplicateCount).toBe(1);
    expect(result.uniqueScenes.map((s) => s.subjectKey)).toEqual(["Donatella Versace", "Cher"]);
  });

  it("drops cross-chunk duplicates against the in-run accepted set", () => {
    const inRun = new Set(["courteney cox"]);
    const scenes = [slideshowScene("Courteney Cox"), slideshowScene("Meg Ryan")];
    const result = filterScenesAgainstChannelMemory(scenes, new Set(), 16, inRun);
    expect(result.droppedDuplicateCount).toBe(1);
    expect(result.uniqueScenes.map((s) => s.subjectKey)).toEqual(["Meg Ryan"]);
    expect(result.acceptedNormalized).toEqual(["meg ryan"]);
    // Function is pure: it must not mutate the caller's set.
    expect(inRun.has("meg ryan")).toBe(false);
  });

  it('fills blank subjectKey with a deterministic "story-beat" fallback', () => {
    const scenes: Scene[] = [{ ...slideshowScene("x"), subjectKey: "   " }];
    const { uniqueScenes } = filterScenesAgainstChannelMemory(scenes, new Set(), 40);
    expect(uniqueScenes[0]?.subjectKey).toBe("story-beat-41");
  });
});
