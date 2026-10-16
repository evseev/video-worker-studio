export type ImageSourceId = "pinterest" | "commons" | "google-images" | "manual";

/** A downloaded image that may be used for a scene slot. */
export interface ImageCandidate {
  /** Stable id within a project (source + hash of URL/path). */
  id: string;
  localPath: string;
  source: ImageSourceId;
  /** Where the image came from (page or file URL), for attribution and audit. */
  sourceUrl: string | null;
  /** License short name (Commons) or null when unknown (Pinterest / Google). */
  license: string | null;
  attribution: string | null;
  /** The search query that produced it. */
  query: string;
}

/** Output of scripts/face-match/face_match.py for one image. */
export interface FaceAnalysis {
  path: string;
  ok: boolean;
  error?: string;
  width?: number;
  height?: number;
  faceCount?: number;
  /** [x, y, w, h] in original image pixels. */
  faceBox?: [number, number, number, number] | null;
  faceScore?: number | null;
  faceAreaRatio?: number;
  blur?: number;
  dhash?: string;
  refSimilarity?: number | null;
  consensusSimilarity?: number | null;
  /** Similarity to a person this photo must NOT show (e.g. the famous partner). */
  excludeSimilarity?: number | null;
  /** Which detected face was chosen (0 = largest). */
  faceIndex?: number;
}

export type Confidence = "high" | "medium" | "low";

export interface RankedCandidate extends ImageCandidate {
  analysis: FaceAnalysis;
  identityScore: number;
  qualityScore: number;
  score: number;
  confidence: Confidence;
  /** Why the candidate was penalised or rejected (shown on the review page). */
  flags: string[];
  rejected: boolean;
}

/** Which era a slot depicts — drives query wording. */
export type SlotEra = "then" | "now" | "any";

export interface SlotRequest {
  sceneIndex: number;
  slotIndex: number;
  /** The person shown in this slot (resolved display name). */
  person: string;
  era: SlotEra;
  /** Optional explicit era year such as 1995 for "then" queries. */
  year?: number | null;
  /** Free-form keyword from the script, used as a fallback query. */
  keyword?: string;
}
