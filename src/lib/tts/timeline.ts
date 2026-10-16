/**
 * Narration-driven timeline. Scenes overlap by `transitionFrames` (TransitionSeries),
 * so scene i starts at start[i-1] + frames[i-1] - transitionFrames.
 * Each scene's voice line starts LEAD_IN seconds into the scene and must end at least
 * GAP seconds before the next scene's line starts.
 */
export const TIMELINE_DEFAULTS = {
  fps: 30,
  transitionFrames: 15,
  leadInSec: 0.35,
  gapSec: 0.45,
  minSceneSec: 5,
  maxSceneSec: 20,
} as const;

export interface TimelineOptions {
  fps?: number;
  transitionFrames?: number;
  leadInSec?: number;
  gapSec?: number;
  minSceneSec?: number;
  maxSceneSec?: number;
}

export interface SceneTiming {
  index: number;
  startFrame: number;
  durationFrames: number;
  /** Absolute time the narration line starts (seconds). */
  audioStartSec: number;
  audioDurationSec: number;
}

export interface Timeline {
  fps: number;
  transitionFrames: number;
  scenes: SceneTiming[];
  totalFrames: number;
  totalSec: number;
}

/** Frames a scene needs so its narration fits without colliding with the next line. */
export function sceneFramesForAudio(audioSec: number, opts: TimelineOptions = {}): number {
  const o = { ...TIMELINE_DEFAULTS, ...opts };
  const transitionSec = o.transitionFrames / o.fps;
  // next line starts at (frames - transition) + leadIn; this line ends at leadIn + audio.
  const needed = audioSec + o.gapSec + transitionSec;
  const sec = Math.min(o.maxSceneSec, Math.max(o.minSceneSec, needed));
  return Math.ceil(sec * o.fps);
}

export function buildTimeline(audioDurations: number[], opts: TimelineOptions = {}): Timeline {
  const o = { ...TIMELINE_DEFAULTS, ...opts };
  const scenes: SceneTiming[] = [];
  let start = 0;
  audioDurations.forEach((audio, index) => {
    const durationFrames = sceneFramesForAudio(audio, o);
    scenes.push({
      index,
      startFrame: start,
      durationFrames,
      audioStartSec: start / o.fps + o.leadInSec,
      audioDurationSec: audio,
    });
    start += durationFrames - o.transitionFrames;
  });
  const totalFrames =
    scenes.reduce((sum, s) => sum + s.durationFrames, 0) - Math.max(0, scenes.length - 1) * o.transitionFrames;
  return { fps: o.fps, transitionFrames: o.transitionFrames, scenes, totalFrames, totalSec: totalFrames / o.fps };
}

/** Total frames for fixed-length scenes (legacy path, matches render-video.ts). */
export function totalFramesFor(durations: number[], transitionFrames: number): number {
  return durations.reduce((a, b) => a + b, 0) - Math.max(0, durations.length - 1) * transitionFrames;
}

// ---------- subtitles ----------

export interface Cue {
  startSec: number;
  endSec: number;
  text: string;
}

/** Split a line into subtitle chunks of at most `maxChars`, preferring sentence and comma breaks. */
export function splitForSubtitles(text: string, maxChars = 84): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean ? [clean] : [];
  const sentences = clean.split(/(?<=[.!?…])\s+/);
  const chunks: string[] = [];
  for (const sentence of sentences) {
    if (sentence.length <= maxChars) {
      chunks.push(sentence);
      continue;
    }
    let current = "";
    for (const part of sentence.split(/(?<=[,;:—])\s+|\s+/)) {
      if ((current + " " + part).trim().length > maxChars && current) {
        chunks.push(current.trim());
        current = part;
      } else {
        current = `${current} ${part}`;
      }
    }
    if (current.trim()) chunks.push(current.trim());
  }
  // merge tiny neighbours
  const merged: string[] = [];
  for (const c of chunks) {
    const last = merged[merged.length - 1];
    if (last && (last + " " + c).length <= maxChars) merged[merged.length - 1] = `${last} ${c}`;
    else merged.push(c);
  }
  return merged;
}

export function cuesForTimeline(lines: string[], timeline: Timeline, maxChars = 84): Cue[] {
  const cues: Cue[] = [];
  timeline.scenes.forEach((s, i) => {
    const chunks = splitForSubtitles(lines[i] ?? "", maxChars);
    const totalChars = chunks.reduce((a, c) => a + c.length, 0) || 1;
    let t = s.audioStartSec;
    for (const chunk of chunks) {
      const dur = (s.audioDurationSec * chunk.length) / totalChars;
      cues.push({ startSec: t, endSec: t + dur, text: chunk });
      t += dur;
    }
  });
  return cues;
}

function srtTime(sec: number): string {
  const ms = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const r = ms % 1000;
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(h)}:${p(m)}:${p(s)},${p(r, 3)}`;
}

/** Wrap a cue into at most two lines of roughly equal length. */
function wrapTwoLines(text: string, maxLine = 42): string {
  if (text.length <= maxLine) return text;
  const mid = Math.floor(text.length / 2);
  let best = -1;
  for (let d = 0; d < mid; d++) {
    if (text[mid - d] === " ") {
      best = mid - d;
      break;
    }
    if (text[mid + d] === " ") {
      best = mid + d;
      break;
    }
  }
  return best > 0 ? `${text.slice(0, best)}\n${text.slice(best + 1)}` : text;
}

export function toSrt(cues: Cue[]): string {
  return (
    cues
      .map((c, i) => `${i + 1}\n${srtTime(c.startSec)} --> ${srtTime(c.endSec)}\n${wrapTwoLines(c.text)}\n`)
      .join("\n") + "\n"
  );
}

// ---------- chapters ----------

export interface Chapter {
  startSec: number;
  title: string;
}

function chapterTime(sec: number): string {
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

/**
 * YouTube chapters: first at 0:00, at least 3, each ≥ 10 s. Scenes are grouped so
 * there are at most `maxChapters`; each chapter is titled after its first scene.
 */
export function buildChapters(
  titles: string[],
  timeline: Timeline,
  opts: { maxChapters?: number; introTitle?: string | null } = {}
): Chapter[] {
  const n = timeline.scenes.length;
  if (n === 0) return [];
  const maxChapters = opts.maxChapters ?? 16;
  const group = Math.max(1, Math.ceil(n / maxChapters));
  const chapters: Chapter[] = [];
  for (let i = 0; i < n; i += group) {
    const startSec = i === 0 ? 0 : timeline.scenes[i].startFrame / timeline.fps;
    const title = i === 0 && opts.introTitle ? opts.introTitle : titles[i] || `Part ${chapters.length + 1}`;
    const prev = chapters[chapters.length - 1];
    if (prev && startSec - prev.startSec < 10) continue;
    chapters.push({ startSec, title });
  }
  // drop a final chapter shorter than 10s
  const last = chapters[chapters.length - 1];
  if (chapters.length > 1 && timeline.totalSec - last.startSec < 10) chapters.pop();
  return chapters.length >= 3 ? chapters : [];
}

export function chaptersToText(chapters: Chapter[]): string {
  return chapters.map((c) => `${chapterTime(c.startSec)} ${c.title}`).join("\n");
}
