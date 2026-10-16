/**
 * Narration QA: compare what the TTS actually said (speech-to-text) with the script, per line.
 * Pure helpers (normalisation, similarity, token → line assignment) are exported for tests.
 */

const SMALL_NUMBERS: Record<string, string> = {
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
  eleven: "11", twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15", sixteen: "16", seventeen: "17",
  eighteen: "18", nineteen: "19", twenty: "20", thirty: "30", forty: "40", fifty: "50", sixty: "60",
};

/** Lower-case words, digits normalised, delivery tags / punctuation removed. */
export function normalizeForCompare(text: string): string[] {
  return text
    .replace(/\[[a-z -]+\]/gi, " ")
    .replace(/(\d)\s*(am|pm)\b/gi, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/'/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => SMALL_NUMBERS[w] ?? w);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/**
 * Character-level similarity (0–1) of the normalised texts. Tolerates spelling variants of
 * names that speech-to-text cannot know ("Sedgewick" vs "Sedgwick") while catching dropped
 * or garbled clauses.
 */
export function narrationSimilarity(script: string, transcript: string): number {
  const a = normalizeForCompare(script).join(" ");
  const b = normalizeForCompare(transcript).join(" ");
  if (!a && !b) return 1;
  const dist = levenshtein(a, b);
  return 1 - dist / Math.max(a.length, b.length, 1);
}

export interface SttToken {
  text: string;
  start_ms: number;
  end_ms: number;
}

/** Split recognised tokens back into lines using the known offset of each clip in the joined audio. */
export function tokensToLines(tokens: SttToken[], offsetsMs: Array<{ start: number; end: number }>): string[] {
  const lines = offsetsMs.map(() => "");
  for (const t of tokens) {
    const mid = (t.start_ms + t.end_ms) / 2;
    const i = offsetsMs.findIndex((o) => mid >= o.start && mid < o.end);
    if (i >= 0) lines[i] += t.text;
  }
  return lines.map((l) => l.replace(/\s+/g, " ").trim());
}

export const NARRATION_SIMILARITY_THRESHOLD = 0.82;
