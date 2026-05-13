import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyDefaultsToDraftPayload,
  buildDefaultSettingsSnapshotFromInsert,
  getLastProjectSettings,
  snapshotSettingsToChannel,
} from "@/lib/channels/defaults";

function chain<T>(v: T) {
  return Promise.resolve(v);
}

describe("channels/defaults", () => {
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

  beforeEach(() => {
    warnSpy.mockClear();
  });

  it("getLastProjectSettings maps row and draft settings", async () => {
    const row = {
      selected_template: "comparison",
      aspect_ratio: "16:9",
      video_quality: "720p",
      background_music: "calm-1",
      caption_style: "bold",
      comparison_overlay_mode: "labels-only",
      scene_transition: "wipe",
      image_motion: "pan",
      text_animation: "fade",
      draft_scenes: { settings: { sceneCount: 12, sceneDuration: 8, captionStyle: "bold" } },
      voiceover_url: "https://x/v.mp3",
    };
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            neq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: () => chain({ data: row, error: null }),
                }),
              }),
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const got = await getLastProjectSettings(supabase, "c1");
    expect(got).not.toBeNull();
    expect(got?.selected_template).toBe("comparison");
    expect(got?.hadVoiceover).toBe(true);
    expect(got?.draftSceneSettings?.sceneCount).toBe(12);
  });

  it("getLastProjectSettings returns null when no row", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            neq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: () => chain({ data: null, error: null }),
                }),
              }),
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    expect(await getLastProjectSettings(supabase, "c1")).toBeNull();
  });

  it("getLastProjectSettings returns null on query error", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            neq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: () => chain({ data: null, error: { message: "boom" } }),
                }),
              }),
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    expect(await getLastProjectSettings(supabase, "c1")).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("applyDefaultsToDraftPayload returns base when defaults null", () => {
    const base = {
      topic: "t",
      user_id: "u1",
      channel_id: "c1",
      status: "draft",
      wizard_step: "template",
    } as const;
    expect(applyDefaultsToDraftPayload(null, { ...base })).toEqual(base);
  });

  it("applyDefaultsToDraftPayload merges columns and draft; clears voiceover_url", () => {
    const defaults = {
      selected_template: "fact-card",
      aspect_ratio: "9:16",
      video_quality: "1080p",
      background_music: "upbeat-2",
      caption_style: "minimal",
      comparison_overlay_mode: "both",
      scene_transition: "fade",
      image_motion: "zoom-in",
      text_animation: "slide-up",
      draftSceneSettings: { sceneCount: 20, sceneDuration: 4 },
      hadVoiceover: true,
    };
    const base = {
      topic: "hello",
      user_id: "u1",
      channel_id: "c1",
      status: "draft",
      wizard_step: "template",
    };
    const merged = applyDefaultsToDraftPayload(defaults, base);
    expect(merged.selected_template).toBe("fact-card");
    expect(merged.aspect_ratio).toBe("9:16");
    expect(merged.voiceover_url).toBeNull();
    expect(merged.draft_scenes).toEqual({
      settings: expect.objectContaining({ sceneCount: 20, sceneDuration: 4 }),
    });
  });

  it("applyDefaultsToDraftPayload preserves explicit base overrides", () => {
    const defaults = {
      selected_template: "fact-card",
      aspect_ratio: "9:16",
      video_quality: "1080p",
      background_music: null,
      caption_style: null,
      comparison_overlay_mode: "both",
      scene_transition: "fade",
      image_motion: "zoom-in",
      text_animation: "slide-up",
      draftSceneSettings: null,
      hadVoiceover: false,
    };
    const base = {
      topic: "x",
      user_id: "u1",
      channel_id: "c1",
      status: "draft",
      wizard_step: "template",
      aspect_ratio: "16:9",
      draft_scenes: { settings: { sceneCount: 5 } },
    };
    const merged = applyDefaultsToDraftPayload(defaults, base);
    expect(merged.aspect_ratio).toBe("16:9");
    expect(merged.draft_scenes).toEqual({ settings: { sceneCount: 5 } });
  });

  it("snapshotSettingsToChannel warns and does not throw on update error", async () => {
    const supabase = {
      from: () => ({
        update: () => ({
          eq: () => chain({ error: { message: "nope" } }),
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(
      snapshotSettingsToChannel(supabase, "c1", {
        aspect_ratio: "16:9",
        sceneCount: 6,
        sceneDuration: 5,
      })
    ).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      "[channels/defaults] snapshotSettingsToChannel failed:",
      "nope"
    );
  });

  it("buildDefaultSettingsSnapshotFromInsert uses voiceoverPreferred override", () => {
    const snap = buildDefaultSettingsSnapshotFromInsert(
      {
        topic: "t",
        user_id: "u",
        channel_id: "c",
        aspect_ratio: "9:16",
        voiceover_url: null,
        draft_scenes: { settings: { sceneCount: 9, sceneDuration: 6 } },
      },
      { voiceoverPreferred: true }
    );
    expect(snap?.voiceoverPreferred).toBe(true);
    expect(snap?.sceneCount).toBe(9);
  });
});
