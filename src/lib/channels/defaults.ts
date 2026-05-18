import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Json, TablesInsert } from "@/lib/supabase/types";
import { clampSceneCount, clampSceneDuration } from "@/lib/video-constraints";

const PROJECT_SELECT_FOR_COPY =
  "selected_template, aspect_ratio, video_quality, background_music, caption_style, comparison_overlay_mode, scene_transition, image_motion, text_animation, draft_scenes, voiceover_url" as const;

type ProjectCopyRow = {
  selected_template: string | null;
  aspect_ratio: string;
  video_quality: string;
  background_music: string | null;
  caption_style: string | null;
  comparison_overlay_mode: string;
  scene_transition: string;
  image_motion: string;
  text_animation: string;
  draft_scenes: Json | null;
  voiceover_url: string | null;
};

export type CopiedProjectSettings = {
  selected_template: string | null;
  aspect_ratio: string;
  video_quality: string;
  background_music: string | null;
  caption_style: string | null;
  comparison_overlay_mode: string;
  scene_transition: string;
  image_motion: string;
  text_animation: string;
  /** Subset of wizard `draft_scenes.settings` (scene count/duration + mirrored fields). */
  draftSceneSettings: Record<string, unknown> | null;
  hadVoiceover: boolean;
};

const channelDefaultSettingsSnapshotSchema = z
  .object({
    selected_template: z.string().nullable().optional(),
    aspect_ratio: z.string().optional(),
    video_quality: z.string().optional(),
    background_music: z.string().nullable().optional(),
    caption_style: z.string().nullable().optional(),
    comparison_overlay_mode: z.string().optional(),
    scene_transition: z.string().optional(),
    image_motion: z.string().optional(),
    text_animation: z.string().optional(),
    sceneCount: z.number().optional(),
    sceneDuration: z.number().optional(),
    voiceoverPreferred: z.boolean().optional(),
  })
  .strip();

export type ChannelDefaultSettingsSnapshot = z.infer<typeof channelDefaultSettingsSnapshotSchema>;

function parseDraftSceneSettings(draft: Json | null): Record<string, unknown> | null {
  if (draft === null || draft === undefined) return null;
  if (typeof draft === "string") {
    try {
      const parsed: unknown = JSON.parse(draft);
      return parseDraftSceneSettings(parsed as Json);
    } catch {
      return null;
    }
  }
  if (Array.isArray(draft)) return null;
  if (typeof draft !== "object") return null;
  const settings = (draft as Record<string, unknown>).settings;
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return null;
  return { ...settings } as Record<string, unknown>;
}

function rowToCopiedSettings(row: ProjectCopyRow): CopiedProjectSettings {
  const draftSceneSettings = parseDraftSceneSettings(row.draft_scenes);
  return {
    selected_template: row.selected_template,
    aspect_ratio: row.aspect_ratio,
    video_quality: row.video_quality,
    background_music: row.background_music,
    caption_style: row.caption_style,
    comparison_overlay_mode: row.comparison_overlay_mode,
    scene_transition: row.scene_transition,
    image_motion: row.image_motion,
    text_animation: row.text_animation,
    draftSceneSettings,
    hadVoiceover: Boolean(row.voiceover_url && row.voiceover_url.length > 0),
  };
}

export async function getLastProjectSettings(
  supabase: SupabaseClient,
  channelId: string
): Promise<CopiedProjectSettings | null> {
  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_SELECT_FOR_COPY)
    .eq("channel_id", channelId)
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[channels/defaults] getLastProjectSettings query failed:", error.message);
    return null;
  }
  if (!data) return null;
  return rowToCopiedSettings(data as ProjectCopyRow);
}

type ProjectInsert = TablesInsert<"projects">;

const COPIED_COLUMN_KEYS: readonly (keyof ProjectInsert)[] = [
  "selected_template",
  "aspect_ratio",
  "video_quality",
  "background_music",
  "caption_style",
  "comparison_overlay_mode",
  "scene_transition",
  "image_motion",
  "text_animation",
];

function isExplicitKey<K extends keyof ProjectInsert>(
  base: ProjectInsert,
  key: K
): boolean {
  return Object.prototype.hasOwnProperty.call(base, key) && base[key] !== undefined;
}

function buildDraftScenesJson(
  defaults: CopiedProjectSettings,
  baseDraft: Json | null | undefined
): Json | null {
  const fromLast = defaults.draftSceneSettings;
  if (!fromLast || Object.keys(fromLast).length === 0) {
    if (baseDraft === undefined) return null;
    return baseDraft ?? null;
  }

  let baseObj: Record<string, unknown> = {};
  if (baseDraft !== undefined && baseDraft !== null) {
    if (typeof baseDraft === "string") {
      try {
        const p: unknown = JSON.parse(baseDraft);
        if (p && typeof p === "object" && !Array.isArray(p)) baseObj = p as Record<string, unknown>;
      } catch {
        baseObj = {};
      }
    } else if (typeof baseDraft === "object" && !Array.isArray(baseDraft)) {
      baseObj = { ...(baseDraft as Record<string, unknown>) };
    }
  }

  const prevSettings =
    baseObj.settings && typeof baseObj.settings === "object" && !Array.isArray(baseObj.settings)
      ? (baseObj.settings as Record<string, unknown>)
      : {};

  const sceneCountRaw = fromLast.sceneCount;
  const sceneDurationRaw = fromLast.sceneDuration;
  const nextSettings: Record<string, unknown> = {
    ...prevSettings,
    ...fromLast,
  };
  if (typeof sceneCountRaw === "number") {
    nextSettings.sceneCount = clampSceneCount(sceneCountRaw);
  }
  if (typeof sceneDurationRaw === "number") {
    nextSettings.sceneDuration = clampSceneDuration(sceneDurationRaw);
  }

  return { ...baseObj, settings: nextSettings } as unknown as Json;
}

/**
 * Merges copied channel last-project settings into a draft insert payload.
 * Does not copy `voiceover_url` (storage path); new drafts start without an uploaded file.
 */
export function applyDefaultsToDraftPayload(
  defaults: CopiedProjectSettings | null,
  basePayload: ProjectInsert
): ProjectInsert {
  if (!defaults) return basePayload;

  const merged: ProjectInsert = { ...basePayload };

  for (const key of COPIED_COLUMN_KEYS) {
    if (!isExplicitKey(merged, key)) {
      (merged as Record<string, unknown>)[key as string] = defaults[key as keyof CopiedProjectSettings];
    }
  }

  if (!isExplicitKey(merged, "draft_scenes")) {
    merged.draft_scenes = buildDraftScenesJson(defaults, merged.draft_scenes);
  }

  if (!isExplicitKey(merged, "voiceover_url")) {
    merged.voiceover_url = null;
  }

  return merged;
}

export function buildDefaultSettingsSnapshotFromInsert(
  payload: ProjectInsert,
  options?: { voiceoverPreferred?: boolean }
): ChannelDefaultSettingsSnapshot | null {
  const draftSettings = parseDraftSceneSettings(payload.draft_scenes ?? null);
  const sceneCount =
    typeof draftSettings?.sceneCount === "number" ? clampSceneCount(draftSettings.sceneCount) : undefined;
  const sceneDuration =
    typeof draftSettings?.sceneDuration === "number"
      ? clampSceneDuration(draftSettings.sceneDuration)
      : undefined;

  const voiceoverPreferred =
    options?.voiceoverPreferred !== undefined
      ? options.voiceoverPreferred
      : Boolean(payload.voiceover_url && payload.voiceover_url.length > 0);

  const raw = {
    selected_template: payload.selected_template ?? undefined,
    aspect_ratio: payload.aspect_ratio ?? undefined,
    video_quality: payload.video_quality ?? undefined,
    background_music: payload.background_music ?? undefined,
    caption_style: payload.caption_style ?? undefined,
    comparison_overlay_mode: payload.comparison_overlay_mode ?? undefined,
    scene_transition: payload.scene_transition ?? undefined,
    image_motion: payload.image_motion ?? undefined,
    text_animation: payload.text_animation ?? undefined,
    sceneCount,
    sceneDuration,
    voiceoverPreferred,
  };

  const parsed = channelDefaultSettingsSnapshotSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn("[channels/defaults] default_settings snapshot validation failed:", parsed.error.flatten());
    return null;
  }
  return parsed.data;
}

export async function snapshotSettingsToChannel(
  supabase: SupabaseClient,
  channelId: string,
  settings: ChannelDefaultSettingsSnapshot
): Promise<void> {
  const validated = channelDefaultSettingsSnapshotSchema.safeParse(settings);
  if (!validated.success) {
    console.warn("[channels/defaults] refusing channel snapshot — invalid settings:", validated.error.flatten());
    return;
  }

  const { error } = await supabase
    .from("channels")
    .update({
      default_settings: validated.data as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", channelId);

  if (error) {
    console.warn("[channels/defaults] snapshotSettingsToChannel failed:", error.message);
  }
}
