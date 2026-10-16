import { describe, it, expect } from "vitest";
import { classifyConfidence, hammingHex, rankCandidates, identityScore } from "@/lib/images/rank";
import { faceObjectPosition, slotSize } from "@/lib/images/crop";
import type { FaceAnalysis, ImageCandidate } from "@/lib/images/types";

function cand(id: string, a: Partial<FaceAnalysis>): ImageCandidate & { analysis: FaceAnalysis } {
  return {
    id,
    localPath: `/tmp/${id}.jpg`,
    source: "pinterest",
    sourceUrl: null,
    license: null,
    attribution: null,
    query: "q",
    analysis: { path: `/tmp/${id}.jpg`, ok: true, width: 1200, height: 1500, faceCount: 1, faceAreaRatio: 0.08, blur: 300, ...a },
  };
}

describe("confidence (calibrated on real Pinterest results)", () => {
  it("same person: high consensus", () => expect(classifyConfidence(0.3, 0.53)).toBe("high"));
  it("same person, strong reference match", () => expect(classifyConfidence(0.41, null)).toBe("high"));
  it("same person, older photo vs modern reference", () => expect(classifyConfidence(0.18, 0.49)).toBe("medium"));
  it("different person sharing results", () => expect(classifyConfidence(0.18, 0.14)).toBe("low"));
  it("no signal", () => expect(classifyConfidence(null, null)).toBe("low"));
});

describe("ranking", () => {
  it("puts the verified, sharp photo first and rejects faceless ones", () => {
    const ranked = rankCandidates([
      cand("wrong", { refSimilarity: 0.1, consensusSimilarity: 0.05, dhash: "0000000000000000" }),
      cand("right", { refSimilarity: 0.42, consensusSimilarity: 0.55, dhash: "ffffffffffffffff" }),
      cand("noface", { faceCount: 0, dhash: "00000000ffffffff" }),
    ]);
    expect(ranked[0].id).toBe("right");
    expect(ranked[0].confidence).toBe("high");
    expect(ranked.find((c) => c.id === "noface")?.rejected).toBe(true);
    expect(ranked.find((c) => c.id === "wrong")?.confidence).toBe("low");
  });

  it("drops near-duplicates inside a slot", () => {
    const ranked = rankCandidates([
      cand("a", { refSimilarity: 0.45, consensusSimilarity: 0.5, dhash: "f0f0f0f0f0f0f0f0" }),
      cand("b", { refSimilarity: 0.44, consensusSimilarity: 0.5, dhash: "f0f0f0f0f0f0f0f1" }),
    ]);
    expect(ranked).toHaveLength(1);
  });

  it("penalises group photos for single-person slots", () => {
    const ranked = rankCandidates([
      cand("group", { refSimilarity: 0.45, consensusSimilarity: 0.5, faceCount: 3, dhash: "0123456789abcdef" }),
      cand("solo", { refSimilarity: 0.42, consensusSimilarity: 0.48, dhash: "fedcba9876543210" }),
    ]);
    expect(ranked[0].id).toBe("solo");
    expect(ranked[1].flags).toContain("3 faces in photo");
  });

  it("hamming distance on hex dHashes", () => {
    expect(hammingHex("0000000000000000", "0000000000000001")).toBe(1);
    expect(hammingHex("ffffffffffffffff", "0000000000000000")).toBe(64);
  });

  it("identity favours consensus when both exist", () => {
    expect(identityScore({ path: "", ok: true, refSimilarity: 0.2, consensusSimilarity: 0.6 })).toBeCloseTo(0.42, 2);
  });
});

describe("face-aware crop", () => {
  it("centres a face that sits on the left of a wide photo", () => {
    const pos = faceObjectPosition({ imageWidth: 2000, imageHeight: 1000, faceBox: [200, 200, 200, 250], targetWidth: 958, targetHeight: 1080 });
    const [x] = pos.split(" ").map(parseFloat);
    expect(x).toBeLessThan(20);
  });

  it("keeps faces in the upper part of tall photos", () => {
    const pos = faceObjectPosition({ imageWidth: 1000, imageHeight: 3000, faceBox: [400, 300, 200, 250], targetWidth: 958, targetHeight: 1080 });
    const [, y] = pos.split(" ").map(parseFloat);
    expect(y).toBeLessThan(15);
  });

  it("is centred when there is no overflow", () => {
    expect(faceObjectPosition({ imageWidth: 958, imageHeight: 1080, faceBox: [100, 100, 50, 50], targetWidth: 958, targetHeight: 1080 })).toBe("50% 50%");
  });

  it("knows the comparison half-frame size", () => {
    expect(slotSize("comparison", 0, { width: 1920, height: 1080 })).toEqual({ width: 958, height: 1080 });
    expect(slotSize("comparison", 1, { width: 1080, height: 1920 })).toEqual({ width: 1080, height: 958 });
  });
});
