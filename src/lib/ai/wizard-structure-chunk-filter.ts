import { normalizeSubject } from "@/lib/ai/dedupe";
import type { Scene } from "@/templates/types";

/**
 * Drops only scenes whose subject overlaps **channel cross-video memory** exclusions.
 *
 * IMPORTANT: Chunked generation must NOT treat subjects from earlier chunks in the *same*
 * video as forbidden here — otherwise the model's occasional repeated `subjectKey`s across
 * chunks silently shrink the scene list (shortfalls vs `sceneCount`, e.g. 43 vs 62).
 * Prompt-time `excludeSubjects` still pushes the model toward distinct subjects chunk-to-chunk.
 */
function ensureSceneSubjectKey(scene: Scene, chunkBaseIndex: number, ordinal: number): Scene {
  if (normalizeSubject(scene.subjectKey).length > 0) return scene;
  const label = `story-beat-${chunkBaseIndex + ordinal + 1}`;
  return { ...scene, subjectKey: label };
}

export function filterScenesAgainstChannelMemory(
  scenes: Scene[],
  channelNormalizedExcludes: Set<string>,
  chunkBaseIndex: number
): { uniqueScenes: Scene[]; droppedCount: number } {
  const uniqueScenes: Scene[] = [];
  let droppedCount = 0;
  scenes.forEach((scene, ordinal) => {
    const enriched = ensureSceneSubjectKey(scene, chunkBaseIndex, ordinal);
    const normalized = normalizeSubject(enriched.subjectKey);
    if (channelNormalizedExcludes.has(normalized)) {
      droppedCount += 1;
      return;
    }
    uniqueScenes.push(enriched);
  });
  return { uniqueScenes, droppedCount };
}
