import type { Confidence, FaceAnalysis, ImageCandidate, RankedCandidate } from "./types";

/**
 * Thresholds calibrated on SFace cosine similarity (OpenCV zoo, ~0.363 = same person)
 * with real Pinterest results: same-person consensus 0.33–0.59, other-person 0.04–0.16;
 * reference similarity drops with age gap (a 2019 portrait vs 1990s photos: 0.18–0.40).
 */
export const RANK_THRESHOLDS = {
  highRef: 0.4,
  highConsensus: 0.4,
  highRefWithConsensus: 0.25,
  mediumRef: 0.3,
  mediumConsensus: 0.33,
  minShortSide: 400,
  goodShortSide: 800,
  minBlur: 25,
  goodBlur: 150,
  /** Hamming distance on 64-bit dHash below which two images are near-duplicates. */
  duplicateBits: 6,
} as const;

export function hammingHex(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let bits = 0;
  for (let i = 0; i < a.length; i += 4) {
    let x = parseInt(a.slice(i, i + 4), 16) ^ parseInt(b.slice(i, i + 4), 16);
    while (x) {
      bits += x & 1;
      x >>>= 1;
    }
  }
  return bits;
}

export function classifyConfidence(ref: number | null | undefined, consensus: number | null | undefined): Confidence {
  const t = RANK_THRESHOLDS;
  const r = ref ?? null;
  const c = consensus ?? null;
  if (r !== null && r >= t.highRef) return "high";
  if (c !== null && c >= t.highConsensus && (r === null || r >= t.highRefWithConsensus)) return "high";
  if ((r !== null && r >= t.mediumRef) || (c !== null && c >= t.mediumConsensus)) return "medium";
  return "low";
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

export function identityScore(a: FaceAnalysis): number {
  const r = a.refSimilarity ?? null;
  const c = a.consensusSimilarity ?? null;
  if (r === null && c === null) return 0;
  if (r === null) return clamp01(c!);
  if (c === null) return clamp01(r);
  // Consensus is more robust to age gaps; the reference anchors identity when results are noisy.
  return clamp01(0.55 * c + 0.45 * r);
}

export function qualityScore(a: FaceAnalysis): { score: number; flags: string[] } {
  const t = RANK_THRESHOLDS;
  const flags: string[] = [];
  const shortSide = Math.min(a.width ?? 0, a.height ?? 0);
  const res = clamp01((shortSide - t.minShortSide) / (t.goodShortSide - t.minShortSide));
  if (shortSide < t.goodShortSide) flags.push(`low resolution (${shortSide}px)`);
  const blur = a.blur ?? 0;
  const sharp = clamp01((blur - t.minBlur) / (t.goodBlur - t.minBlur));
  if (blur < t.goodBlur) flags.push("soft or blurry");
  const area = a.faceAreaRatio ?? 0;
  // Portrait sweet spot: face covers 2–30% of the frame.
  const framing = area <= 0 ? 0 : area < 0.02 ? area / 0.02 : area > 0.3 ? clamp01(1 - (area - 0.3) / 0.4) : 1;
  if (area > 0 && area < 0.02) flags.push("face is small in frame");
  if (area > 0.3) flags.push("face very tight");
  const score = 0.35 * res + 0.35 * sharp + 0.3 * framing;
  return { score, flags };
}

/**
 * Score and order candidates for one slot. Rejected candidates stay in the list
 * (sorted last) so the review page can still offer them.
 */
export function rankCandidates(
  candidates: Array<ImageCandidate & { analysis: FaceAnalysis }>,
  opts: { expectSingleFace?: boolean; excludeHashes?: string[] } = {}
): RankedCandidate[] {
  const t = RANK_THRESHOLDS;
  const expectSingle = opts.expectSingleFace ?? true;
  const ranked: RankedCandidate[] = candidates.map((c) => {
    const a = c.analysis;
    const flags: string[] = [];
    let rejected = false;
    if (!a.ok) {
      rejected = true;
      flags.push(a.error ?? "unreadable image");
    }
    if (a.ok && (a.faceCount ?? 0) === 0) {
      rejected = true;
      flags.push("no face detected");
    }
    if (Math.min(a.width ?? 0, a.height ?? 0) < t.minShortSide) {
      rejected = true;
      flags.push("too small");
    }
    if (expectSingle && (a.faceCount ?? 0) > 1) flags.push(`${a.faceCount} faces in photo`);
    if (opts.excludeHashes?.length && a.dhash && opts.excludeHashes.some((h) => hammingHex(h, a.dhash!) <= t.duplicateBits)) {
      flags.push("duplicate of an image used elsewhere");
    }
    const id = identityScore(a);
    const q = qualityScore(a);
    flags.push(...q.flags);
    const confidence = rejected ? "low" : classifyConfidence(a.refSimilarity, a.consensusSimilarity);
    if (confidence === "low" && !rejected) flags.push("identity not confirmed");
    const multiFacePenalty = expectSingle && (a.faceCount ?? 0) > 1 ? 0.75 : 1;
    const dupPenalty = flags.includes("duplicate of an image used elsewhere") ? 0.5 : 1;
    const score = rejected ? 0 : (0.65 * id + 0.35 * q.score) * multiFacePenalty * dupPenalty;
    return { ...c, identityScore: id, qualityScore: q.score, score, confidence, flags, rejected };
  });

  // Drop near-duplicates within the slot, keeping the higher score.
  ranked.sort((x, y) => Number(x.rejected) - Number(y.rejected) || y.score - x.score);
  const kept: RankedCandidate[] = [];
  for (const c of ranked) {
    const dup = c.analysis.dhash
      ? kept.find((k) => k.analysis.dhash && hammingHex(k.analysis.dhash, c.analysis.dhash!) <= t.duplicateBits)
      : undefined;
    if (!dup) kept.push(c);
  }
  return kept;
}
