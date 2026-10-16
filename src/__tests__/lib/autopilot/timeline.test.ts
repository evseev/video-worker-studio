import { describe, it, expect } from "vitest";
import {
  buildTimeline,
  sceneFramesForAudio,
  splitForSubtitles,
  cuesForTimeline,
  toSrt,
  buildChapters,
  chaptersToText,
  totalFramesFor,
} from "@/lib/tts/timeline";

describe("timeline", () => {
  it("sizes a scene so the next line never overlaps", () => {
    // 6s of audio + 0.45s gap + 0.5s transition = 6.95s → 209 frames
    expect(sceneFramesForAudio(6)).toBe(209);
  });

  it("clamps very short and very long lines", () => {
    expect(sceneFramesForAudio(0.5)).toBe(150); // min 5s
    expect(sceneFramesForAudio(60)).toBe(600); // max 20s
  });

  it("chains scenes with overlapping transitions", () => {
    const t = buildTimeline([6, 7, 5]);
    expect(t.scenes[0].startFrame).toBe(0);
    expect(t.scenes[1].startFrame).toBe(t.scenes[0].durationFrames - 15);
    expect(t.totalFrames).toBe(totalFramesFor(t.scenes.map((s) => s.durationFrames), 15));
    // each line ends before the next line begins
    for (let i = 0; i < t.scenes.length - 1; i++) {
      const end = t.scenes[i].audioStartSec + t.scenes[i].audioDurationSec;
      expect(end).toBeLessThan(t.scenes[i + 1].audioStartSec);
    }
  });

  it("splits long narration into subtitle-sized chunks", () => {
    const text =
      "Kurt Russell and Goldie Hawn met on the set of Swing Shift in 1983, and they have been together ever since. They never married, and they say that is part of the secret.";
    const chunks = splitForSubtitles(text, 84);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(84);
    expect(chunks.join(" ")).toBe(text);
  });

  it("writes valid SRT with increasing times", () => {
    const t = buildTimeline([4, 4]);
    const cues = cuesForTimeline(["First line here.", "Second line here."], t);
    const srt = toSrt(cues);
    expect(srt).toMatch(/^1\n00:00:00,350 --> 00:00:04,350\nFirst line here\.\n/);
    expect(srt).toContain("\n2\n");
    expect(cues[1].startSec).toBeGreaterThan(cues[0].endSec);
  });

  it("builds YouTube-valid chapters (0:00 first, ≥3, ≥10s apart)", () => {
    const t = buildTimeline(Array(40).fill(7));
    const chapters = buildChapters(Array.from({ length: 40 }, (_, i) => `Pair ${i}`), t, { introTitle: "Intro" });
    expect(chapters[0]).toEqual({ startSec: 0, title: "Intro" });
    expect(chapters.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < chapters.length; i++) expect(chapters[i].startSec - chapters[i - 1].startSec).toBeGreaterThanOrEqual(10);
    expect(chaptersToText(chapters).split("\n")[0]).toBe("0:00 Intro");
  });

  it("returns no chapters for very short videos", () => {
    const t = buildTimeline([5, 5]);
    expect(buildChapters(["a", "b"], t)).toEqual([]);
  });
});
