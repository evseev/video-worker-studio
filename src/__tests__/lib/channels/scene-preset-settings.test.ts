import { describe, it, expect } from "vitest";
import {
  parseScenePresetSettingsJson,
  scenePresetPayloadToWizardState,
  wizardStateToScenePresetPayload,
} from "@/lib/channels/scene-preset-settings";
import type { VideoSettings } from "@/lib/stores/wizard-store";

const sampleSettings: VideoSettings = {
  sceneCount: 8,
  sceneDuration: 6,
  aspectRatio: "9:16",
  quality: "1080p",
  sceneTransition: "fade",
  imageMotion: "zoom-in",
  textAnimation: "slide-up",
  captionStyle: "minimal",
  comparisonOverlayMode: "both",
};

describe("scene-preset-settings", () => {
  it("round-trips wizard state through JSON payload", () => {
    const payload = wizardStateToScenePresetPayload("comparison", sampleSettings);
    const parsed = parseScenePresetSettingsJson(payload);
    expect(parsed).not.toBeNull();
    const next = scenePresetPayloadToWizardState(parsed!);
    expect(next.selectedTemplate).toBe("comparison");
    expect(next.settings.sceneCount).toBe(8);
    expect(next.settings.captionStyle).toBe("minimal");
  });
});
