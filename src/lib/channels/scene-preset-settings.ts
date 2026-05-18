import { z } from "zod";
import type { VideoSettings } from "@/lib/stores/wizard-store";
import type { TemplateId } from "@/templates/types";
import { parseCaptionStyle, parseComparisonOverlayMode } from "@/lib/comparison-caption-styles";
import { clampSceneCount, clampSceneDuration } from "@/lib/video-constraints";

const SceneTransitionSchema = z.enum(["fade", "slide", "wipe", "flip", "clock-wipe", "random"]);
const ImageMotionSchema = z.enum([
  "zoom-in",
  "zoom-out",
  "pan-left",
  "pan-right",
  "pan-up",
  "pan-down",
  "pan-horizontal",
  "pan-vertical",
  "none",
  "random",
]);
const TextAnimationSchema = z.enum(["slide-up", "slide-left", "typewriter", "pop", "fade-in", "random"]);
const CaptionStyleSchema = z.enum(["minimal", "bold", "strip", "split", "glowing"]);
const OverlaySchema = z.enum(["labels", "caption", "both"]);

export const ScenePresetSettingsJsonSchema = z
  .object({
    selectedTemplate: z.enum(["slideshow", "comparison", "fact-card"]),
    settings: z.object({
      sceneCount: z.number(),
      sceneDuration: z.number(),
      aspectRatio: z.enum(["16:9", "9:16"]),
      quality: z.enum(["720p", "1080p", "4k"]),
      sceneTransition: SceneTransitionSchema,
      imageMotion: ImageMotionSchema,
      textAnimation: TextAnimationSchema,
      captionStyle: CaptionStyleSchema,
      comparisonOverlayMode: OverlaySchema,
    }),
  })
  .strict();

export type ScenePresetSettingsPayload = z.infer<typeof ScenePresetSettingsJsonSchema>;

export function parseScenePresetSettingsJson(raw: unknown): ScenePresetSettingsPayload | null {
  const parsed = ScenePresetSettingsJsonSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function scenePresetPayloadToWizardState(payload: ScenePresetSettingsPayload): {
  selectedTemplate: TemplateId;
  settings: VideoSettings;
} {
  const s = payload.settings;
  return {
    selectedTemplate: payload.selectedTemplate,
    settings: {
      sceneCount: clampSceneCount(s.sceneCount),
      sceneDuration: clampSceneDuration(s.sceneDuration),
      aspectRatio: s.aspectRatio,
      quality: s.quality,
      sceneTransition: s.sceneTransition,
      imageMotion: s.imageMotion,
      textAnimation: s.textAnimation,
      captionStyle: parseCaptionStyle(s.captionStyle),
      comparisonOverlayMode: parseComparisonOverlayMode(s.comparisonOverlayMode),
    },
  };
}

export function wizardStateToScenePresetPayload(
  selectedTemplate: TemplateId,
  settings: VideoSettings
): ScenePresetSettingsPayload {
  return {
    selectedTemplate,
    settings: {
      sceneCount: settings.sceneCount,
      sceneDuration: settings.sceneDuration,
      aspectRatio: settings.aspectRatio,
      quality: settings.quality,
      sceneTransition: settings.sceneTransition,
      imageMotion: settings.imageMotion,
      textAnimation: settings.textAnimation,
      captionStyle: settings.captionStyle,
      comparisonOverlayMode: settings.comparisonOverlayMode,
    },
  };
}
