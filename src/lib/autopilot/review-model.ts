import * as path from "path";
import type { PipelineState, PickedImage } from "./pipeline";
import { pairCaption, pairLabels } from "./formats";

/** What the review page needs — no absolute paths leave the server. */
export interface ReviewPhoto {
  url: string;
  objectPosition: string;
  confidence: "high" | "medium" | "low";
  identityScore: number;
  flags: string[];
  source: string;
  width: number;
  height: number;
}

export interface ReviewPair {
  index: number;
  caption: string;
  leftLabel: string;
  rightLabel: string;
  relation: string;
  leftName: string;
  rightName: string;
  leftSource: string;
  rightSource: string;
  left: ReviewPhoto | null;
  right: ReviewPhoto | null;
  leftAlternatives: ReviewPhoto[];
  rightAlternatives: ReviewPhoto[];
  scriptText: string;
  narrationSource: string;
  problems: string[];
  /** Speech-to-text check of this pair's narration (null when not run). */
  voiceCheck: { ok: boolean; similarity: number; transcript: string } | null;
  needsAttention: boolean;
}

export interface ReviewModel {
  projectId: string;
  reviewStatus: string | null;
  topic: string;
  format: string;
  titles: string[];
  hook: string;
  outro: string;
  pairs: ReviewPair[];
  rejected: Array<{ left: string; right: string; reason: string }>;
  durationSec: number | null;
  stages: PipelineState["stages"];
  bundle: Array<{ name: string; url: string }>;
  videoUrl: string | null;
}

export function fileUrl(projectId: string, runDir: string, file: string, download = false): string {
  const rel = path.relative(runDir, file).split(path.sep).join("/");
  return `/api/autopilot/${projectId}/file?path=${encodeURIComponent(rel)}${download ? "&download=1" : ""}`;
}

export function toReviewModel(projectId: string, runDir: string, state: PipelineState, reviewStatus: string | null): ReviewModel {
  const photo = (p: PickedImage | null | undefined): ReviewPhoto | null =>
    p
      ? {
          url: fileUrl(projectId, runDir, p.path),
          objectPosition: p.objectPosition,
          confidence: p.confidence,
          identityScore: p.identityScore,
          flags: p.flags,
          source: p.source,
          width: p.width,
          height: p.height,
        }
      : null;

  const pairs: ReviewPair[] = (state.pairs ?? []).map((p, i) => {
    const vp = { left: p.left, right: p.right, relation: p.relation, relationKind: p.relationKind };
    const labels = pairLabels(vp);
    const img = state.images?.[String(i)];
    const n = state.narration?.[i];
    const left = photo(img?.left.chosen);
    const right = photo(img?.right.chosen);
    const rel = p.relation;
    // voice lines are hook, pairs…, outro → pair i is voice line i + 1
    const vc = state.voice?.qa?.[i + 1];
    const voiceCheck = vc ? { ok: vc.ok, similarity: vc.similarity, transcript: vc.transcript } : null;
    return {
      index: i,
      caption: pairCaption(vp),
      leftLabel: labels.leftLabel,
      rightLabel: labels.rightLabel,
      relation: `${p.relationKind}${rel?.startYear ? ` since ${rel.startYear}` : ""}${rel?.endYear ? ` until ${rel.endYear}` : ""}`,
      leftName: p.left.name,
      rightName: p.right.name,
      leftSource: p.left.sourceUrl,
      rightSource: p.right.sourceUrl,
      left,
      right,
      leftAlternatives: (img?.left.alternatives ?? []).map((a) => photo(a)!).filter(Boolean),
      rightAlternatives: (img?.right.alternatives ?? []).map((a) => photo(a)!).filter(Boolean),
      scriptText: n?.scriptText ?? "",
      narrationSource: n?.source ?? "",
      problems: n?.problems ?? [],
      voiceCheck,
      needsAttention:
        !left || !right || left.confidence === "low" || right.confidence === "low" || n?.source === "fallback" || voiceCheck?.ok === false,
    };
  });

  const bundleDir = path.join(runDir, "bundle");
  const bundleFiles = [
    "video.mp4",
    "thumbnail-labels.png",
    "thumbnail-banner.png",
    "thumbnail-names.png",
    "metadata.txt",
    "chapters.txt",
    "captions.en.srt",
    ...state.locales.flatMap((l) => [`captions.${l}.srt`, `audio.${l}.mp3`]),
  ];
  return {
    projectId,
    reviewStatus,
    topic: state.topic,
    format: state.format,
    titles: state.packaging?.titles ?? [],
    hook: state.packaging?.hook ?? "",
    outro: state.packaging?.outro ?? "",
    pairs,
    rejected: state.rejected ?? [],
    durationSec: state.voice?.timeline.totalSec ?? null,
    stages: state.stages,
    bundle: state.stages.bundle ? bundleFiles.map((name) => ({ name, url: fileUrl(projectId, runDir, path.join(bundleDir, name), true) })) : [],
    videoUrl: state.outputs?.video ? fileUrl(projectId, runDir, state.outputs.video) : null,
  };
}
