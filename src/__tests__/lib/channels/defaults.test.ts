import { describe, it, expect } from "vitest";
import type { TablesInsert } from "@/lib/supabase/types";
import {
  applyDefaultsToDraftPayload,
  buildDefaultSettingsSnapshotFromInsert,
} from "@/lib/channels/defaults";

describe("channels/defaults copy-last-settings boundary", () => {
  it("applyDefaultsToDraftPayload does not overwrite columns explicitly set on payload", () => {
    const defaults = {
      selected_template: "slideshow",
      aspect_ratio: "9:16",
      video_quality: "1080p",
      background_music: "chill",
      caption_style: "minimal",
      comparison_overlay_mode: "both",
      scene_transition: "fade",
      image_motion: "zoom-in",
      text_animation: "slide-up",
      draftSceneSettings: { sceneCount: 12, sceneDuration: 8 },
      hadVoiceover: true,
    };
    const base: TablesInsert<"projects"> = {
      user_id: "u1",
      topic: "t",
      channel_id: "c1",
      aspect_ratio: "16:9",
      video_quality: "1080p",
      comparison_overlay_mode: "both",
      scene_transition: "fade",
      image_motion: "zoom-in",
      text_animation: "slide-up",
    };
    const merged = applyDefaultsToDraftPayload(defaults, base);
    expect(merged.aspect_ratio).toBe("16:9");
    expect(merged.selected_template).toBe("slideshow");
    expect(merged.voiceover_url).toBeNull();
  });

  it("buildDefaultSettingsSnapshotFromInsert returns null when snapshot Zod parse fails", () => {
    const bad = {
      user_id: "u",
      topic: "t",
      channel_id: "c",
      aspect_ratio: "9:16",
      video_quality: "1080p",
      comparison_overlay_mode: "both",
      scene_transition: "fade",
      image_motion: "zoom-in",
      text_animation: "slide-up",
      draft_scenes: { settings: { sceneCount: Number.NaN } },
    } as TablesInsert<"projects">;
    expect(buildDefaultSettingsSnapshotFromInsert(bad)).toBeNull();
  });
});
