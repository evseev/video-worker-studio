import type { Tables } from "@/lib/supabase/types";
import type { Json } from "@/lib/supabase/types";
import {
  parseCaptionStyle,
  parseComparisonOverlayMode,
  type CaptionStyleId,
  type ComparisonOverlayMode,
} from "@/lib/comparison-caption-styles";

export type ProjectRow = Tables<"projects">;

export type MergedRenderPayload = {
  projectId: string;
  scenes?: unknown;
  template: string;
  aspectRatio: string;
  videoQuality: string;
  sceneDuration: number;
  backgroundMusic: string | null;
  voiceoverUrl: string | null;
  sceneTransition: string;
  imageMotion: string;
  textAnimation: string;
  captionStyle: CaptionStyleId;
  comparisonOverlayMode: ComparisonOverlayMode;
};

function parseDraftScenes(draft: Json | null): {
  scenes?: unknown;
  settings?: Record<string, unknown>;
  refinedIdea?: unknown;
} {
  if (draft == null) return {};
  let raw: unknown;
  if (typeof draft === "string") {
    try {
      raw = JSON.parse(draft) as unknown;
    } catch {
      return {};
    }
  } else {
    raw = draft;
  }
  if (Array.isArray(raw)) return { scenes: raw };
  if (raw && typeof raw === "object" && "scenes" in raw) {
    const o = raw as {
      scenes?: unknown;
      settings?: Record<string, unknown>;
      refinedIdea?: unknown;
    };
    return { scenes: o.scenes, settings: o.settings, refinedIdea: o.refinedIdea };
  }
  return {};
}

function coalesce<T>(...vals: (T | null | undefined)[]): T | undefined {
  for (const v of vals) {
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

/**
 * Merge JSON body (wizard or sparse retry) with DB row + draft_scenes.
 * Request body wins when a field is present (including explicit null for music/VO where applicable).
 */
export function mergeRenderPayload(
  body: Record<string, unknown>,
  row: ProjectRow
): MergedRenderPayload {
  const draft = parseDraftScenes(row.draft_scenes);
  const settings = draft.settings ?? {};

  const projectId = (body.projectId as string) ?? row.id;

  const scenes = body.scenes !== undefined ? body.scenes : draft.scenes;

  const template = (body.template as string) ?? row.selected_template ?? "slideshow";

  const aspectRatio = (body.aspectRatio as string) ?? row.aspect_ratio ?? "9:16";

  const videoQuality = (body.videoQuality as string) ?? row.video_quality ?? "1080p";

  const sceneDurationRaw = coalesce<number | undefined>(
    body.sceneDuration as number | undefined,
    typeof settings.sceneDuration === "number" ? settings.sceneDuration : undefined
  );
  const sceneDuration =
    typeof sceneDurationRaw === "number" && Number.isFinite(sceneDurationRaw)
      ? sceneDurationRaw
      : 5;

  const backgroundMusic =
    body.backgroundMusic !== undefined
      ? (body.backgroundMusic as string | null)
      : row.background_music ?? null;

  const voiceoverUrl =
    body.voiceoverUrl !== undefined
      ? (body.voiceoverUrl as string | null)
      : row.voiceover_url ?? null;

  const sceneTransition =
    (body.sceneTransition as string) ??
    (typeof settings.sceneTransition === "string" ? settings.sceneTransition : undefined) ??
    row.scene_transition ??
    "fade";

  const imageMotion =
    (body.imageMotion as string) ??
    (typeof settings.imageMotion === "string" ? settings.imageMotion : undefined) ??
    row.image_motion ??
    "zoom-in";

  const textAnimation =
    (body.textAnimation as string) ??
    (typeof settings.textAnimation === "string" ? settings.textAnimation : undefined) ??
    row.text_animation ??
    "slide-up";

  /** Draft settings reflect latest wizard edits; prefer over row columns until render persists. */
  const captionRaw = coalesce<string | null | undefined>(
    body.captionStyle as string | undefined,
    typeof settings.captionStyle === "string" ? settings.captionStyle : undefined,
    row.caption_style
  );
  const captionStyle = parseCaptionStyle(captionRaw ?? null);

  const overlayRaw = coalesce<string | undefined>(
    body.comparisonOverlayMode as string | undefined,
    typeof settings.comparisonOverlayMode === "string"
      ? settings.comparisonOverlayMode
      : undefined,
    row.comparison_overlay_mode
  );
  const comparisonOverlayMode = parseComparisonOverlayMode(overlayRaw ?? null);

  return {
    projectId,
    scenes,
    template,
    aspectRatio,
    videoQuality,
    sceneDuration,
    backgroundMusic,
    voiceoverUrl,
    sceneTransition,
    imageMotion,
    textAnimation,
    captionStyle,
    comparisonOverlayMode,
  };
}

/** Persist draft_scenes after render dispatch — keeps wizard + dashboard in sync with merged values. */
export function buildPersistedDraft(
  row: ProjectRow,
  merged: MergedRenderPayload
): Record<string, unknown> {
  const draft = parseDraftScenes(row.draft_scenes);
  const prev = (draft.settings ?? {}) as Record<string, unknown>;
  const aspect =
    merged.aspectRatio === "16:9" || merged.aspectRatio === "9:16"
      ? merged.aspectRatio
      : "9:16";
  const quality = ["720p", "1080p", "4k"].includes(merged.videoQuality)
    ? merged.videoQuality
    : "1080p";
  return {
    scenes: merged.scenes,
    refinedIdea: draft.refinedIdea,
    settings: {
      ...prev,
      sceneCount: typeof prev.sceneCount === "number" ? prev.sceneCount : 6,
      sceneDuration: merged.sceneDuration,
      aspectRatio: aspect,
      quality,
      sceneTransition: merged.sceneTransition,
      imageMotion: merged.imageMotion,
      textAnimation: merged.textAnimation,
      captionStyle: merged.captionStyle,
      comparisonOverlayMode: merged.comparisonOverlayMode,
    },
  };
}
