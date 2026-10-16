import * as path from "path";
import { z } from "zod";
import type { PipelineState, PickedImage, SlotPick, StageName } from "./pipeline";

/** Root folder for DB-backed autopilot runs. */
export function autopilotRoot(): string {
  return path.resolve(/* turbopackIgnore: true */ process.env.AUTOPILOT_OUT_DIR ?? path.join(/* turbopackIgnore: true */ process.cwd(), "out", "autopilot"));
}

export function projectRunDir(projectId: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) throw new Error("Invalid project id");
  return path.join(/* turbopackIgnore: true */ autopilotRoot(), "projects", projectId);
}

/** Resolve a user-supplied relative path inside a run directory, refusing traversal. */
export function safeRunPath(runDir: string, rel: string): string | null {
  const root = path.resolve(/* turbopackIgnore: true */ runDir);
  const full = path.resolve(/* turbopackIgnore: true */ root, rel);
  return full === root || full.startsWith(root + path.sep) ? full : null;
}

// ---------------------------------------------------------------- edits

const PositionSchema = z.string().regex(/^\d{1,3}(\.\d)?% \d{1,3}(\.\d)?%$/);

export const ReviewEditsSchema = z.object({
  pairs: z
    .array(
      z.object({
        index: z.number().int().min(0),
        /** Swap the chosen photo with alternative #n (0-based) on that side. */
        leftAlternative: z.number().int().min(0).optional(),
        rightAlternative: z.number().int().min(0).optional(),
        leftObjectPosition: PositionSchema.optional(),
        rightObjectPosition: PositionSchema.optional(),
        scriptText: z.string().min(5).max(400).optional(),
        /** Remove the pair from the video. */
        remove: z.boolean().optional(),
      })
    )
    .default([]),
  titleIndex: z.number().int().min(0).optional(),
  hook: z.string().min(5).max(400).optional(),
  outro: z.string().min(5).max(400).optional(),
});

export type ReviewEdits = z.infer<typeof ReviewEditsSchema>;

function swap(slot: SlotPick, alt: number | undefined): SlotPick {
  if (alt === undefined || !slot.alternatives[alt]) return slot;
  const next = slot.alternatives[alt];
  const alternatives = slot.alternatives.filter((_, i) => i !== alt);
  if (slot.chosen) alternatives.unshift(slot.chosen);
  return { chosen: next, alternatives };
}

function reposition(slot: SlotPick, pos: string | undefined): SlotPick {
  if (!pos || !slot.chosen) return slot;
  const chosen: PickedImage = { ...slot.chosen, objectPosition: pos };
  return { ...slot, chosen };
}

/**
 * Apply review-page edits to a pipeline state. Returns the new state and the stages
 * that must be re-run (narration edits invalidate voice and everything after it).
 */
export function applyReviewEdits(state: PipelineState, edits: ReviewEdits): { state: PipelineState; rerun: StageName[] } {
  const next: PipelineState = JSON.parse(JSON.stringify(state));
  let voiceChanged = false;
  const removed = new Set<number>();

  for (const e of edits.pairs) {
    if (!next.pairs?.[e.index] || !next.images?.[String(e.index)]) continue;
    if (e.remove) {
      removed.add(e.index);
      continue;
    }
    const img = next.images[String(e.index)];
    let left = swap(img.left, e.leftAlternative);
    let right = swap(img.right, e.rightAlternative);
    left = reposition(left, e.leftObjectPosition);
    right = reposition(right, e.rightObjectPosition);
    next.images[String(e.index)] = { left, right };
    if (e.scriptText && next.narration?.[e.index] && e.scriptText.trim() !== next.narration[e.index].scriptText) {
      next.narration[e.index] = { ...next.narration[e.index], scriptText: e.scriptText.trim(), source: "llm-rewrite", problems: [] };
      voiceChanged = true;
    }
  }

  if (next.packaging) {
    if (edits.titleIndex !== undefined && next.packaging.titles[edits.titleIndex]) {
      const t = next.packaging.titles;
      next.packaging.titles = [t[edits.titleIndex], ...t.filter((_, i) => i !== edits.titleIndex)];
    }
    if (edits.hook && edits.hook.trim() !== next.packaging.hook) {
      next.packaging.hook = edits.hook.trim();
      voiceChanged = true;
    }
    if (edits.outro && edits.outro.trim() !== next.packaging.outro) {
      next.packaging.outro = edits.outro.trim();
      voiceChanged = true;
    }
  }

  if (removed.size > 0 && next.pairs && next.narration && next.images) {
    const keep = next.pairs.map((_, i) => i).filter((i) => !removed.has(i));
    const images: NonNullable<PipelineState["images"]> = {};
    keep.forEach((oldI, newI) => (images[String(newI)] = next.images![String(oldI)]));
    next.pairs = keep.map((i) => next.pairs![i]);
    next.narration = keep.map((i) => next.narration![i]);
    next.images = images;
    voiceChanged = true;
  }

  const rerun: StageName[] = voiceChanged
    ? ["voice", "render", "thumbnails", "localize", "bundle"]
    : ["render", "thumbnails", "localize", "bundle"];
  // Re-running a stage is signalled by clearing its timestamp.
  for (const s of rerun) delete next.stages[s];
  return { state: next, rerun };
}

/** Compact summary stored in projects.autopilot_summary (shown on dashboards). */
export function summarizeState(state: PipelineState): Record<string, unknown> {
  const picks = Object.values(state.images ?? {}).flatMap((v) => [v.left.chosen, v.right.chosen]);
  return {
    title: state.packaging?.titles[0] ?? null,
    titles: state.packaging?.titles ?? [],
    description: state.packaging?.description ?? null,
    tags: state.packaging?.tags?.join(", ") ?? null,
    pairs: state.pairs?.length ?? 0,
    lowConfidencePhotos: picks.filter((p) => p?.confidence === "low").length,
    missingPhotos: picks.filter((p) => !p).length,
    fallbackLines: state.narration?.filter((n) => n.source === "fallback").length ?? 0,
    rejectedPairs: state.rejected?.length ?? 0,
    durationSec: state.voice?.timeline.totalSec ?? null,
    stages: state.stages,
    locales: Object.keys(state.dubs ?? {}),
  };
}
