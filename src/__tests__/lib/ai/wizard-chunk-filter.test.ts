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
  it("does not drop intra-video repeats; only excludes channel-memory matches", () => {
    const channel = new Set(["forbidden persona"]);
    const scenes = [
      slideshowScene("forbidden persona"),
      slideshowScene("allowed"),
      slideshowScene("allowed"),
    ];
    const { uniqueScenes, droppedCount } = filterScenesAgainstChannelMemory(scenes, channel, 0);
    expect(droppedCount).toBe(1);
    expect(uniqueScenes).toHaveLength(2);
    expect(uniqueScenes.map((s) => s.subjectKey)).toEqual(["allowed", "allowed"]);
  });

  it('fills blank subjectKey with a deterministic "story-beat" fallback', () => {
    const scenes: Scene[] = [{ ...slideshowScene("x"), subjectKey: "   " }];
    const { uniqueScenes } = filterScenesAgainstChannelMemory(scenes, new Set(), 40);
    expect(uniqueScenes[0]?.subjectKey).toBe("story-beat-41");
  });
});
