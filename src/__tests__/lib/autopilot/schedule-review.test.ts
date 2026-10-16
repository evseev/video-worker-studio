import { describe, it, expect } from "vitest";
import { nextPublishSlot, tzOffsetMinutes, zonedTimeToUtc } from "@/lib/autopilot/schedule";
import { applyReviewEdits, safeRunPath, summarizeState } from "@/lib/autopilot/review";
import type { PipelineState, PickedImage } from "@/lib/autopilot/pipeline";

const NY = { weekdays: [1, 2, 3, 4, 5], publishHour: 17, timezone: "America/New_York" };

describe("publish schedule", () => {
  it("knows New York offsets across DST", () => {
    expect(tzOffsetMinutes(new Date("2026-07-01T12:00:00Z"), "America/New_York")).toBe(-240);
    expect(tzOffsetMinutes(new Date("2026-12-01T12:00:00Z"), "America/New_York")).toBe(-300);
  });

  it("converts 5 PM local to UTC", () => {
    expect(zonedTimeToUtc(2026, 10, 16, 17, "America/New_York").toISOString()).toBe("2026-10-16T21:00:00.000Z");
    expect(zonedTimeToUtc(2026, 11, 16, 17, "America/New_York").toISOString()).toBe("2026-11-16T22:00:00.000Z");
  });

  it("picks today's slot when there is time, else the next weekday", () => {
    // Friday 2026-10-16 10:00 EDT → same day 17:00 EDT
    expect(nextPublishSlot([], NY, new Date("2026-10-16T14:00:00Z")).toISOString()).toBe("2026-10-16T21:00:00.000Z");
    // Friday 16:30 EDT (within 2h lead) → Monday
    expect(nextPublishSlot([], NY, new Date("2026-10-16T20:30:00Z")).toISOString()).toBe("2026-10-19T21:00:00.000Z");
  });

  it("skips taken days", () => {
    const taken = ["2026-10-16T21:00:00.000Z", "2026-10-19T21:00:00.000Z"];
    expect(nextPublishSlot(taken, NY, new Date("2026-10-16T14:00:00Z")).toISOString()).toBe("2026-10-20T21:00:00.000Z");
  });
});

function img(name: string): PickedImage {
  return { path: `/run/work/${name}.jpg`, objectPosition: "50% 30%", confidence: "high", score: 0.7, identityScore: 0.5, flags: [], source: "pinterest", sourceUrl: null, attribution: null, width: 1000, height: 1200 };
}

function baseState(): PipelineState {
  const person = (qid: string, name: string) => ({ qid, name, description: "", birthYear: 1950, deathYear: null, isDeceased: false, occupations: [], sex: null, spouses: [], partners: [], children: [], imageFile: null, imageUrl: null, wikipediaTitle: null, sourceUrl: "" });
  return {
    version: 1,
    slug: "x",
    topic: "t",
    format: "couples",
    pairsTarget: 2,
    musicId: "lifting-dreams",
    locales: [],
    createdAt: "",
    stages: { script: "a", images: "b", voice: "c", render: "d", thumbnails: "e", bundle: "f" },
    pairs: [
      { left: person("Q1", "A"), right: person("Q2", "B"), relation: null, relationKind: "partner" },
      { left: person("Q3", "C"), right: person("Q4", "D"), relation: null, relationKind: "partner" },
    ],
    narration: [
      { scriptText: "Line one is here.", tone: "warm", source: "llm", problems: [] },
      { scriptText: "Line two is here.", tone: "warm", source: "llm", problems: [] },
    ],
    packaging: { titles: ["T1", "T2", "T3"], hook: "Hook line here", outro: "Outro line here", description: "d".repeat(120), tags: ["a"], thumbnailText: "X" },
    images: {
      "0": { left: { chosen: img("a0"), alternatives: [img("a1"), img("a2")] }, right: { chosen: img("b0"), alternatives: [] } },
      "1": { left: { chosen: img("c0"), alternatives: [] }, right: { chosen: img("d0"), alternatives: [img("d1")] } },
    },
  };
}

describe("review edits", () => {
  it("swaps photos and keeps the previous pick as an alternative; only re-renders", () => {
    const { state, rerun } = applyReviewEdits(baseState(), { pairs: [{ index: 0, leftAlternative: 1, rightObjectPosition: "40% 20%" }] });
    expect(state.images!["0"].left.chosen!.path).toContain("a2");
    expect(state.images!["0"].left.alternatives.map((a) => a.path)).toEqual(["/run/work/a0.jpg", "/run/work/a1.jpg"]);
    expect(state.images!["0"].right.chosen!.objectPosition).toBe("40% 20%");
    expect(rerun).not.toContain("voice");
    expect(state.stages.voice).toBe("c");
    expect(state.stages.render).toBeUndefined();
  });

  it("narration edits re-run the voice", () => {
    const { state, rerun } = applyReviewEdits(baseState(), { pairs: [{ index: 1, scriptText: "A corrected line." }] });
    expect(state.narration![1].scriptText).toBe("A corrected line.");
    expect(rerun).toContain("voice");
    expect(state.stages.voice).toBeUndefined();
  });

  it("removes a pair and re-indexes images", () => {
    const { state } = applyReviewEdits(baseState(), { pairs: [{ index: 0, remove: true }] });
    expect(state.pairs).toHaveLength(1);
    expect(state.pairs![0].left.name).toBe("C");
    expect(state.images!["0"].left.chosen!.path).toContain("c0");
    expect(state.images!["1"]).toBeUndefined();
  });

  it("promotes the chosen title", () => {
    const { state } = applyReviewEdits(baseState(), { pairs: [], titleIndex: 2 });
    expect(state.packaging!.titles).toEqual(["T3", "T1", "T2"]);
  });

  it("refuses path traversal", () => {
    expect(safeRunPath("/run/x", "work/a.jpg")).toBe("/run/x/work/a.jpg");
    expect(safeRunPath("/run/x", "../y/secret")).toBeNull();
    expect(safeRunPath("/run/x", "/etc/passwd")).toBeNull();
  });

  it("summarises for the dashboard", () => {
    const s = summarizeState(baseState());
    expect(s.title).toBe("T1");
    expect(s.pairs).toBe(2);
    expect(s.lowConfidencePhotos).toBe(0);
  });
});
