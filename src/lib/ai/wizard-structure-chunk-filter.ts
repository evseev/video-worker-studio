import { normalizeSubject } from "@/lib/ai/dedupe";
import type { Scene } from "@/templates/types";

/**
 * Dedupes a chunk's scenes against two exclusion sets:
 *
 * 1. `channelNormalizedExcludes` — subjects from this channel's cross-video memory (ADR-003).
 * 2. `inRunNormalizedAccepted`   — subjects already accepted earlier in *this same run*
 *    (previous chunks **and** earlier scenes in the current chunk).
 *
 * Historical note: an earlier version intentionally skipped (2) to avoid shrinking the total
 * scene count when Gemini returned overlapping `subjectKey`s across chunks. That hid the
 * duplicate-scenes bug (the same actor appearing 4× in one video). The caller now compensates
 * for any shortfall by issuing top-up chunk calls, so it is safe — and required — for this
 * filter to drop in-run repeats.
 *
 * The function is pure: it does NOT mutate `inRunNormalizedAccepted`. The caller decides
 * which of the returned `uniqueScenes` to actually keep (it may slice off overflow) and is
 * responsible for adding the accepted subjects to its running set.
 */
function ensureSceneSubjectKey(scene: Scene, chunkBaseIndex: number, ordinal: number): Scene {
  if (normalizeSubject(scene.subjectKey).length > 0) return scene;
  const label = `story-beat-${chunkBaseIndex + ordinal + 1}`;
  return { ...scene, subjectKey: label };
}

export type ChunkFilterResult = {
  uniqueScenes: Scene[];
  /** Normalized subject key per uniqueScene (same length, same order). */
  acceptedNormalized: string[];
  /** Total scenes dropped (channel memory + in-run duplicates). */
  droppedCount: number;
  droppedChannelCount: number;
  droppedDuplicateCount: number;
};

export function filterScenesAgainstChannelMemory(
  scenes: Scene[],
  channelNormalizedExcludes: ReadonlySet<string>,
  chunkBaseIndex: number,
  inRunNormalizedAccepted: ReadonlySet<string> = new Set()
): ChunkFilterResult {
  const uniqueScenes: Scene[] = [];
  const acceptedNormalized: string[] = [];
  const localSeen = new Set<string>(inRunNormalizedAccepted);
  let droppedChannelCount = 0;
  let droppedDuplicateCount = 0;

  scenes.forEach((scene, ordinal) => {
    const enriched = ensureSceneSubjectKey(scene, chunkBaseIndex, ordinal);
    const normalized = normalizeSubject(enriched.subjectKey);
    if (channelNormalizedExcludes.has(normalized)) {
      droppedChannelCount += 1;
      return;
    }
    if (localSeen.has(normalized)) {
      droppedDuplicateCount += 1;
      return;
    }
    localSeen.add(normalized);
    uniqueScenes.push(enriched);
    acceptedNormalized.push(normalized);
  });

  return {
    uniqueScenes,
    acceptedNormalized,
    droppedCount: droppedChannelCount + droppedDuplicateCount,
    droppedChannelCount,
    droppedDuplicateCount,
  };
}
