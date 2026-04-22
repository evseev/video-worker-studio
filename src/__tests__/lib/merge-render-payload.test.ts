import { describe, it, expect } from "vitest";
import { mergeRenderPayload } from "@/lib/merge-render-payload";
import type { Tables } from "@/lib/supabase/types";
import { SCENE_DURATION_MAX, SCENE_DURATION_MIN } from "@/lib/video-constraints";

function baseRow(overrides: Partial<Tables<"projects">> = {}): Tables<"projects"> {
  return {
    id: "p1",
    user_id: "u1",
    topic: "topic",
    status: "draft",
    video_url: null,
    selected_template: "comparison",
    draft_scenes: {
      scenes: [{ template: "comparison", scriptText: "Hi", searchKeywords: ["a", "b"], assets: [{}, {}] }],
      settings: {
        sceneCount: 6,
        sceneDuration: 5,
        aspectRatio: "9:16",
        quality: "1080p",
        sceneTransition: "fade",
        imageMotion: "zoom-in",
        textAnimation: "slide-up",
        captionStyle: "bold",
        comparisonOverlayMode: "labels",
      },
    },
    trend_validation_data: null,
    render_error_context: null,
    aspect_ratio: "9:16",
    video_quality: "1080p",
    background_music: null,
    caption_style: "strip",
    comparison_overlay_mode: "both",
    voiceover_url: null,
    video_description: null,
    video_tags: null,
    video_title: null,
    scene_transition: "fade",
    image_motion: "zoom-in",
    text_animation: "slide-up",
    wizard_step: "render",
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("mergeRenderPayload", () => {
  it("uses body over DB when fields present", () => {
    const merged = mergeRenderPayload(
      {
        projectId: "p1",
        captionStyle: "glowing",
        comparisonOverlayMode: "caption",
        scenes: [{ x: 1 }],
        template: "comparison",
        aspectRatio: "16:9",
        videoQuality: "720p",
        sceneDuration: 7,
      },
      baseRow()
    );
    expect(merged.captionStyle).toBe("glowing");
    expect(merged.comparisonOverlayMode).toBe("caption");
    expect(merged.scenes).toEqual([{ x: 1 }]);
    expect(merged.aspectRatio).toBe("16:9");
    expect(merged.videoQuality).toBe("720p");
    expect(merged.sceneDuration).toBe(7);
  });

  it("fills from DB and draft when body is sparse (dashboard retry)", () => {
    const row = baseRow();
    const merged = mergeRenderPayload({ projectId: "p1" }, row);
    const draft = row.draft_scenes as { scenes: unknown };
    expect(merged.scenes).toEqual(draft.scenes);
    expect(merged.captionStyle).toBe("bold");
    expect(merged.comparisonOverlayMode).toBe("labels");
    expect(merged.template).toBe("comparison");
  });

  it("falls back caption to row when draft settings omit style", () => {
    const row = baseRow({
      draft_scenes: {
        scenes: [],
        settings: {
          sceneCount: 6,
          sceneDuration: 5,
          aspectRatio: "9:16",
          quality: "1080p",
          sceneTransition: "fade",
          imageMotion: "zoom-in",
          textAnimation: "slide-up",
        },
      },
      caption_style: "split",
      comparison_overlay_mode: "caption",
    });
    const merged = mergeRenderPayload({ projectId: "p1" }, row);
    expect(merged.captionStyle).toBe("split");
    expect(merged.comparisonOverlayMode).toBe("caption");
  });

  it("keeps scenes undefined when retry payload and draft have none", () => {
    const row = baseRow({
      draft_scenes: null,
    });
    const merged = mergeRenderPayload({ projectId: "p1" }, row);
    expect(merged.scenes).toBeUndefined();
  });

  it("clamps out-of-range sceneDuration from request body", () => {
    const merged = mergeRenderPayload(
      { projectId: "p1", sceneDuration: 999 },
      baseRow()
    );
    expect(merged.sceneDuration).toBe(SCENE_DURATION_MAX);
  });

  it("clamps out-of-range sceneCount when persisting draft settings", () => {
    const merged = mergeRenderPayload(
      { projectId: "p1", sceneDuration: 1 },
      baseRow({
        draft_scenes: {
          scenes: [],
          settings: { sceneCount: 999, sceneDuration: 5 },
        },
      })
    );
    expect(merged.sceneDuration).toBe(SCENE_DURATION_MIN);
  });
});
